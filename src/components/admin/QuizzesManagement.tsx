import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Edit2, Trash2, Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  num_questions: number;
  time_limit: number;
  is_active: boolean;
  is_premium: boolean;
  requires_login: boolean;
  categories: { name: string } | null;
  subcategories: { name: string } | null;
}

const QuizzesManagement = () => {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuizzes();
  }, []);

  const loadQuizzes = async () => {
    try {
      const { data, error } = await supabase
        .from("quizzes")
        .select(`
          *,
          categories(name),
          subcategories(name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setQuizzes(data || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleQuizStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("quizzes")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;
      toast.success(`Quiz ${!currentStatus ? "activated" : "deactivated"}`);
      loadQuizzes();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const deleteQuiz = async (id: string) => {
    if (!confirm("Are you sure? This will delete all questions and attempts.")) return;

    try {
      const { error } = await supabase.from("quizzes").delete().eq("id", id);
      if (error) throw error;
      toast.success("Quiz deleted successfully");
      loadQuizzes();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading quizzes...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Quizzes Management</h2>
          <p className="text-muted-foreground">Create and manage your quiz content</p>
        </div>
        <Button onClick={() => navigate("/admin/quiz/new")}>
          <Plus className="w-4 h-4 mr-2" />
          Create Quiz
        </Button>
      </div>

      <div className="grid gap-4">
        {quizzes.map((quiz) => (
          <Card key={quiz.id} className={quiz.is_active ? "border-primary/20" : "border-muted"}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <CardTitle className="text-lg">{quiz.title}</CardTitle>
                    {!quiz.is_active && (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                    {quiz.is_premium && (
                      <Badge className="bg-accent text-accent-foreground">Premium</Badge>
                    )}
                    {quiz.requires_login && (
                      <Badge variant="outline">Login Required</Badge>
                    )}
                  </div>
                  {quiz.description && (
                    <CardDescription>{quiz.description}</CardDescription>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    {quiz.categories && (
                      <span>📁 {quiz.categories.name}</span>
                    )}
                    {quiz.subcategories && (
                      <span>→ {quiz.subcategories.name}</span>
                    )}
                    <span>📝 {quiz.num_questions} questions</span>
                    <span>⏱️ {quiz.time_limit} minutes</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleQuizStatus(quiz.id, quiz.is_active)}
                    title={quiz.is_active ? "Deactivate" : "Activate"}
                  >
                    {quiz.is_active ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigate(`/admin/quiz/${quiz.id}`)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteQuiz(quiz.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}

        {quizzes.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No quizzes yet</p>
              <Button onClick={() => navigate("/admin/quiz/new")}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Quiz
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default QuizzesManagement;
