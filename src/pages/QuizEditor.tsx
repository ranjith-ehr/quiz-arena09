import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import QuestionEditor from "@/components/admin/QuestionEditor";
import { z } from "zod";

const quizSchema = z.object({
  title: z.string()
    .trim()
    .min(5, "Title must be at least 5 characters")
    .max(200, "Title must be less than 200 characters"),
  description: z.string()
    .max(500, "Description must be less than 500 characters")
    .optional(),
  category_id: z.string().uuid("Please select a category"),
  subcategory_id: z.string().optional(),
  num_questions: z.number()
    .int()
    .min(1, "Must have at least 1 question")
    .max(100, "Cannot exceed 100 questions"),
  time_limit: z.number()
    .int()
    .min(1, "Time limit must be at least 1 minute")
    .max(180, "Time limit cannot exceed 180 minutes"),
  max_attempts: z.number()
    .int()
    .min(1, "Must allow at least 1 attempt")
    .max(10, "Cannot exceed 10 attempts"),
  is_premium: z.boolean(),
  requires_login: z.boolean(),
  is_active: z.boolean(),
});

interface QuizFormData {
  title: string;
  description: string;
  category_id: string;
  subcategory_id: string;
  num_questions: number;
  time_limit: number;
  max_attempts: number;
  is_premium: boolean;
  requires_login: boolean;
  is_active: boolean;
}

const QuizEditor = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);

  const [formData, setFormData] = useState<QuizFormData>({
    title: "",
    description: "",
    category_id: "",
    subcategory_id: "",
    num_questions: 10,
    time_limit: 30,
    max_attempts: 3,
    is_premium: false,
    requires_login: false,
    is_active: true,
  });

  useEffect(() => {
    loadCategories();
    if (quizId && quizId !== "new") {
      loadQuiz();
    } else {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    if (formData.category_id) {
      loadSubcategories(formData.category_id);
    }
  }, [formData.category_id]);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name");

      if (error) throw error;
      setCategories(data || []);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const loadSubcategories = async (categoryId: string) => {
    try {
      const { data, error } = await supabase
        .from("subcategories")
        .select("*")
        .eq("category_id", categoryId)
        .order("name");

      if (error) throw error;
      setSubcategories(data || []);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const loadQuiz = async () => {
    try {
      const { data: quizData, error: quizError } = await supabase
        .from("quizzes")
        .select("*")
        .eq("id", quizId)
        .single();

      if (quizError) throw quizError;

      setFormData({
        title: quizData.title,
        description: quizData.description || "",
        category_id: quizData.category_id,
        subcategory_id: quizData.subcategory_id || "",
        num_questions: quizData.num_questions,
        time_limit: quizData.time_limit,
        max_attempts: quizData.max_attempts,
        is_premium: quizData.is_premium,
        requires_login: quizData.requires_login,
        is_active: quizData.is_active,
      });

      // Load questions
      const { data: questionsData, error: questionsError } = await supabase
        .from("questions")
        .select(`
          *,
          question_options(*)
        `)
        .eq("quiz_id", quizId)
        .order("order_num");

      if (questionsError) throw questionsError;
      setQuestions(questionsData || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validate form data
    try {
      quizSchema.parse(formData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        toast.error(firstError.message);
        return;
      }
    }

    setSaving(true);
    try {
      const quizData = {
        ...formData,
        subcategory_id: formData.subcategory_id || null,
      };

      if (quizId && quizId !== "new") {
        const { error } = await supabase
          .from("quizzes")
          .update(quizData)
          .eq("id", quizId);

        if (error) throw error;
        toast.success("Quiz updated successfully");
      } else {
        const { data, error } = await supabase
          .from("quizzes")
          .insert([quizData])
          .select()
          .single();

        if (error) throw error;
        toast.success("Quiz created successfully");
        navigate(`/admin/quiz/${data.id}`);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/admin/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-xl font-bold">
            {quizId && quizId !== "new" ? "Edit Quiz" : "Create New Quiz"}
          </h1>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save Quiz"}
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Quiz Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Quiz Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., RRB Group D Mock Test 2025"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category_id: value, subcategory_id: "" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subcategory">Subcategory</Label>
                <Select
                  value={formData.subcategory_id}
                  onValueChange={(value) => setFormData({ ...formData, subcategory_id: value })}
                  disabled={!formData.category_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select subcategory" />
                  </SelectTrigger>
                  <SelectContent>
                    {subcategories.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="num_questions">Number of Questions</Label>
                <Input
                  id="num_questions"
                  type="number"
                  min="1"
                  value={formData.num_questions}
                  onChange={(e) =>
                    setFormData({ ...formData, num_questions: parseInt(e.target.value) || 1 })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="time_limit">Time Limit (minutes)</Label>
                <Input
                  id="time_limit"
                  type="number"
                  min="1"
                  value={formData.time_limit}
                  onChange={(e) =>
                    setFormData({ ...formData, time_limit: parseInt(e.target.value) || 1 })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_attempts">Maximum Attempts</Label>
                <Input
                  id="max_attempts"
                  type="number"
                  min="1"
                  value={formData.max_attempts}
                  onChange={(e) =>
                    setFormData({ ...formData, max_attempts: parseInt(e.target.value) || 1 })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the quiz"
                rows={3}
              />
            </div>

            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="is_active">Active</Label>
                  <p className="text-sm text-muted-foreground">
                    Make this quiz visible to users
                  </p>
                </div>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="is_premium">Premium</Label>
                  <p className="text-sm text-muted-foreground">
                    Require premium access
                  </p>
                </div>
                <Switch
                  id="is_premium"
                  checked={formData.is_premium}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_premium: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="requires_login">Requires Login</Label>
                  <p className="text-sm text-muted-foreground">
                    Users must be logged in to take this quiz
                  </p>
                </div>
                <Switch
                  id="requires_login"
                  checked={formData.requires_login}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, requires_login: checked })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {quizId && quizId !== "new" && (
          <QuestionEditor quizId={quizId} questions={questions} onUpdate={loadQuiz} />
        )}
      </div>
    </div>
  );
};

export default QuizEditor;
