import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight, BookOpen, Clock, Award, BarChart3, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [filteredQuizzes, setFilteredQuizzes] = useState<any[]>([]);

  useEffect(() => {
    loadCategories();
    loadQuizzes();
  }, []);

  useEffect(() => {
    if (selectedCategory !== "all") {
      loadSubcategories(selectedCategory);
    } else {
      setSubcategories([]);
      setSelectedSubcategory("all");
    }
  }, [selectedCategory]);

  useEffect(() => {
    filterQuizzes();
  }, [quizzes, selectedCategory, selectedSubcategory, searchQuery]);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name");
      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error("Error loading categories:", error);
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
    } catch (error) {
      console.error("Error loading subcategories:", error);
    }
  };

  const loadQuizzes = async () => {
    try {
      const { data, error } = await supabase
        .from("quizzes")
        .select("*, categories(name)")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setQuizzes(data || []);
    } catch (error) {
      console.error("Error loading quizzes:", error);
    }
  };

  const filterQuizzes = () => {
    let filtered = [...quizzes];

    if (selectedCategory !== "all") {
      filtered = filtered.filter((q) => q.category_id === selectedCategory);
    }

    if (selectedSubcategory !== "all") {
      filtered = filtered.filter((q) => q.subcategory_id === selectedSubcategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (q) =>
          q.title.toLowerCase().includes(query) ||
          q.description?.toLowerCase().includes(query)
      );
    }

    setFilteredQuizzes(filtered);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      {/* Header */}
      <Navbar />

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="inline-block">
            <span className="px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold">
              🎯 Central Government Exam Preparation
            </span>
          </div>
          <h2 className="text-5xl md:text-6xl font-bold leading-tight">
            Master Your{" "}
            <span className="bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              Government Exams
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Practice with thousands of MCQs designed for RRB, SSC, and other central government exams. 
            Track your progress and ace your tests!
          </p>
          <div className="flex items-center justify-center gap-4 pt-4">
            <Button size="lg" onClick={() => navigate("/quizzes")} className="group">
              Start Practicing
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/auth?redirect=/dashboard")}>
              View Dashboard
            </Button>
          </div>
        </div>
      </section>

      {/* Search and Filter Section */}
      <section className="container mx-auto px-4 pb-12">
        <Card className="max-w-4xl mx-auto shadow-lg">
          <CardHeader>
            <CardTitle className="text-center">Find Your Perfect Quiz</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input
                placeholder="Search quizzes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Subcategory</label>
                <Select
                  value={selectedSubcategory}
                  onValueChange={setSelectedSubcategory}
                  disabled={selectedCategory === "all" || subcategories.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Subcategories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subcategories</SelectItem>
                    {subcategories.map((sub) => (
                      <SelectItem key={sub.id} value={sub.id}>
                        {sub.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {filteredQuizzes.length > 0 && (
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-3">
                  Found {filteredQuizzes.length} quiz{filteredQuizzes.length !== 1 ? "es" : ""}
                </p>
                <div className="grid gap-3 max-h-96 overflow-y-auto">
                  {filteredQuizzes.map((quiz) => (
                    <Card
                      key={quiz.id}
                      className="cursor-pointer hover:border-primary transition-colors"
                      onClick={() => navigate(`/quiz/${quiz.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold">{quiz.title}</h3>
                            <p className="text-sm text-muted-foreground">
                              {quiz.categories?.name}
                            </p>
                          </div>
                          <div className="text-right text-sm">
                            <p className="text-muted-foreground">{quiz.num_questions} questions</p>
                            <p className="text-muted-foreground">{quiz.time_limit} mins</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="border-primary/20 hover:border-primary/40 transition-colors hover:shadow-lg">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <CardTitle>Multiple Categories</CardTitle>
              <CardDescription>
                Organized quizzes for RRB, SSC, and other government exams
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-secondary/20 hover:border-secondary/40 transition-colors hover:shadow-lg">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center mb-2">
                <Clock className="w-6 h-6 text-secondary" />
              </div>
              <CardTitle>Timed Quizzes</CardTitle>
              <CardDescription>
                Practice under real exam conditions with time limits
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-accent/20 hover:border-accent/40 transition-colors hover:shadow-lg">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-2">
                <BarChart3 className="w-6 h-6 text-accent" />
              </div>
              <CardTitle>Detailed Analytics</CardTitle>
              <CardDescription>
                Track your performance with comprehensive statistics
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-success/20 hover:border-success/40 transition-colors hover:shadow-lg">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center mb-2">
                <Award className="w-6 h-6 text-success-foreground" />
              </div>
              <CardTitle>Instant Results</CardTitle>
              <CardDescription>
                Get immediate feedback with detailed explanations
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16">
        <Card className="bg-gradient-to-br from-primary via-secondary to-primary border-none text-primary-foreground overflow-hidden relative">
          <div className="absolute inset-0 bg-grid-white/10" />
          <CardContent className="relative p-12 text-center">
            <h3 className="text-3xl font-bold mb-4">Ready to Start Your Journey?</h3>
            <p className="text-primary-foreground/90 mb-6 max-w-2xl mx-auto">
              Join thousands of aspirants who are preparing for their government exams with QuizMaster.
              Start practicing today and boost your confidence!
            </p>
            <Button size="lg" variant="secondary" onClick={() => navigate("/quizzes")} className="group">
              Browse All Quizzes
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card/50 backdrop-blur-sm mt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-semibold">QuizMaster</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 QuizMaster. Empowering exam aspirants.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
