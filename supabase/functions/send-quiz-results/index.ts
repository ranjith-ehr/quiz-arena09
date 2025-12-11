import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// HTML escape function to prevent XSS
const escapeHtml = (str: string): string => {
  if (!str) return "";
  return str.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c] || c);
};

interface QuizResultRequest {
  email: string;
  userName: string;
  quizTitle: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  timeTaken: string;
  results: Array<{
    questionText: string;
    selectedOption: string;
    correctOption: string;
    isCorrect: boolean;
  }>;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      console.error("Authentication failed:", authError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const {
      email,
      userName,
      quizTitle,
      score,
      totalQuestions,
      percentage,
      timeTaken,
      results,
    }: QuizResultRequest = await req.json();

    // Validate that the email matches the authenticated user
    if (user.email !== email) {
      console.error("Email mismatch: user tried to send to different email");
      return new Response(JSON.stringify({ error: "Cannot send results to a different email address" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Escape all user-provided content to prevent XSS
    const safeUserName = escapeHtml(userName);
    const safeQuizTitle = escapeHtml(quizTitle);
    const safeTimeTaken = escapeHtml(timeTaken);

    const questionsHtml = results
      .map(
        (q, idx) => `
        <div style="margin-bottom: 20px; padding: 15px; background-color: ${
          q.isCorrect ? "#f0fdf4" : "#fef2f2"
        }; border-radius: 8px;">
          <p style="font-weight: bold; margin-bottom: 10px;">Question ${idx + 1}: ${escapeHtml(q.questionText)}</p>
          <p style="margin: 5px 0;">Your Answer: <span style="color: ${
            q.isCorrect ? "#16a34a" : "#dc2626"
          };">${escapeHtml(q.selectedOption)}</span></p>
          ${
            !q.isCorrect
              ? `<p style="margin: 5px 0;">Correct Answer: <span style="color: #16a34a;">${escapeHtml(q.correctOption)}</span></p>`
              : ""
          }
        </div>
      `
      )
      .join("");

    // Send email using Resend API
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      throw new Error("Email service not configured");
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "QuizMaster <onboarding@resend.dev>",
        to: [email],
        subject: `Your Quiz Results: ${safeQuizTitle}`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; }
                .score-card { background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
                .score { font-size: 48px; font-weight: bold; color: #667eea; }
                .percentage { font-size: 24px; color: #6b7280; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Quiz Results</h1>
                  <p>${safeQuizTitle}</p>
                </div>
                <div class="content">
                  <p>Dear ${safeUserName},</p>
                  <p>Congratulations on completing the quiz! Here are your results:</p>
                  
                  <div class="score-card">
                    <div class="score">${Number(score)}/${Number(totalQuestions)}</div>
                    <div class="percentage">${Number(percentage).toFixed(1)}%</div>
                    <p style="margin: 10px 0 0 0; color: #6b7280;">Time Taken: ${safeTimeTaken}</p>
                  </div>

                  <h2>Question-by-Question Breakdown:</h2>
                  ${questionsHtml}

                  <p style="margin-top: 30px;">Keep practicing to improve your score!</p>
                  <p>Best regards,<br>The QuizMaster Team</p>
                </div>
              </div>
            </body>
          </html>
        `,
      }),
    });

    const emailData = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("Resend API error:", emailData);
      throw new Error(emailData.message || "Failed to send email");
    }

    console.log("Email sent successfully to:", email);

    return new Response(JSON.stringify(emailData), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-quiz-results function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
