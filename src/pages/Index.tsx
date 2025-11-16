import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, BookOpen, Clock, Award, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";

const Index = () => {
  const navigate = useNavigate();

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
            <Button size="lg" variant="outline" onClick={() => navigate("/auth?redirect=/quizzes")}>
              View Dashboard
            </Button>
          </div>
        </div>
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
