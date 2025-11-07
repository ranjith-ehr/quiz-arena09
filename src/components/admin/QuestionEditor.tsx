import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Plus, Trash2, Image as ImageIcon } from "lucide-react";

interface QuestionEditorProps {
  quizId: string;
  questions: any[];
  onUpdate: () => void;
}

const QuestionEditor = ({ quizId, questions, onUpdate }: QuestionEditorProps) => {
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [questionForm, setQuestionForm] = useState({
    question_text: "",
    question_image_url: "",
    explanation: "",
    correct_option: "A",
    options: [
      { label: "A", text: "", image_url: "" },
      { label: "B", text: "", image_url: "" },
      { label: "C", text: "", image_url: "" },
      { label: "D", text: "", image_url: "" },
    ],
  });

  const resetForm = () => {
    setQuestionForm({
      question_text: "",
      question_image_url: "",
      explanation: "",
      correct_option: "A",
      options: [
        { label: "A", text: "", image_url: "" },
        { label: "B", text: "", image_url: "" },
        { label: "C", text: "", image_url: "" },
        { label: "D", text: "", image_url: "" },
      ],
    });
    setEditingQuestion(null);
  };

  const loadQuestionForEdit = (question: any) => {
    setEditingQuestion(question);
    setQuestionForm({
      question_text: question.question_text,
      question_image_url: question.question_image_url || "",
      explanation: question.explanation || "",
      correct_option: question.correct_option,
      options: question.question_options.map((opt: any) => ({
        label: opt.option_label,
        text: opt.option_text,
        image_url: opt.option_image_url || "",
      })),
    });
  };

  const handleSaveQuestion = async () => {
    if (!questionForm.question_text) {
      toast.error("Please enter a question");
      return;
    }

    if (questionForm.options.some((opt) => !opt.text)) {
      toast.error("Please fill in all options");
      return;
    }

    try {
      const questionData = {
        quiz_id: quizId,
        question_text: questionForm.question_text,
        question_image_url: questionForm.question_image_url || null,
        explanation: questionForm.explanation || null,
        correct_option: questionForm.correct_option,
        order_num: editingQuestion ? editingQuestion.order_num : questions.length + 1,
      };

      let questionId: string;

      if (editingQuestion) {
        const { error } = await supabase
          .from("questions")
          .update(questionData)
          .eq("id", editingQuestion.id);

        if (error) throw error;
        questionId = editingQuestion.id;

        // Delete existing options
        await supabase
          .from("question_options")
          .delete()
          .eq("question_id", questionId);
      } else {
        const { data, error } = await supabase
          .from("questions")
          .insert([questionData])
          .select()
          .single();

        if (error) throw error;
        questionId = data.id;
      }

      // Insert options
      const optionsData = questionForm.options.map((opt) => ({
        question_id: questionId,
        option_label: opt.label,
        option_text: opt.text,
        option_image_url: opt.image_url || null,
      }));

      const { error: optionsError } = await supabase
        .from("question_options")
        .insert(optionsData);

      if (optionsError) throw optionsError;

      toast.success(editingQuestion ? "Question updated" : "Question added");
      resetForm();
      onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm("Delete this question?")) return;

    try {
      const { error } = await supabase.from("questions").delete().eq("id", questionId);
      if (error) throw error;
      toast.success("Question deleted");
      onUpdate();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{editingQuestion ? "Edit Question" : "Add New Question"}</span>
            {editingQuestion && (
              <Button variant="ghost" onClick={resetForm}>
                Cancel Edit
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="question_text">Question *</Label>
            <Textarea
              id="question_text"
              value={questionForm.question_text}
              onChange={(e) =>
                setQuestionForm({ ...questionForm, question_text: e.target.value })
              }
              placeholder="Enter your question"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="question_image">Question Image URL (optional)</Label>
            <Input
              id="question_image"
              value={questionForm.question_image_url}
              onChange={(e) =>
                setQuestionForm({ ...questionForm, question_image_url: e.target.value })
              }
              placeholder="https://..."
            />
          </div>

          <div className="space-y-4">
            <Label>Options *</Label>
            <RadioGroup
              value={questionForm.correct_option}
              onValueChange={(value) =>
                setQuestionForm({ ...questionForm, correct_option: value })
              }
            >
              {questionForm.options.map((option, index) => (
                <div key={option.label} className="border rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value={option.label} id={`option-${option.label}`} />
                    <Label htmlFor={`option-${option.label}`} className="font-bold">
                      Option {option.label} {questionForm.correct_option === option.label && "(Correct)"}
                    </Label>
                  </div>
                  <Input
                    value={option.text}
                    onChange={(e) => {
                      const newOptions = [...questionForm.options];
                      newOptions[index].text = e.target.value;
                      setQuestionForm({ ...questionForm, options: newOptions });
                    }}
                    placeholder={`Enter option ${option.label}`}
                  />
                  <Input
                    value={option.image_url}
                    onChange={(e) => {
                      const newOptions = [...questionForm.options];
                      newOptions[index].image_url = e.target.value;
                      setQuestionForm({ ...questionForm, options: newOptions });
                    }}
                    placeholder="Image URL (optional)"
                  />
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="explanation">Explanation (optional)</Label>
            <Textarea
              id="explanation"
              value={questionForm.explanation}
              onChange={(e) =>
                setQuestionForm({ ...questionForm, explanation: e.target.value })
              }
              placeholder="Explain why this is the correct answer"
              rows={3}
            />
          </div>

          <Button onClick={handleSaveQuestion} className="w-full">
            {editingQuestion ? "Update Question" : "Add Question"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Questions ({questions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {questions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No questions added yet. Create your first question above!
            </p>
          ) : (
            <div className="space-y-4">
              {questions.map((question, index) => (
                <div key={question.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium mb-2">
                        Q{index + 1}. {question.question_text}
                      </p>
                      <div className="text-sm text-muted-foreground space-y-1">
                        {question.question_options.map((opt: any) => (
                          <p key={opt.id}>
                            {opt.option_label}. {opt.option_text}
                            {question.correct_option === opt.option_label && " ✓"}
                          </p>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => loadQuestionForEdit(question)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteQuestion(question.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QuestionEditor;
