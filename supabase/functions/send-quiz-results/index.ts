import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const questionsHtml = results
      .map(
        (q, idx) => `
        <div style="margin-bottom: 20px; padding: 15px; background-color: ${
          q.isCorrect ? "#f0fdf4" : "#fef2f2"
        }; border-radius: 8px;">
          <p style="font-weight: bold; margin-bottom: 10px;">Question ${idx + 1}: ${q.questionText}</p>
          <p style="margin: 5px 0;">Your Answer: <span style="color: ${
            q.isCorrect ? "#16a34a" : "#dc2626"
          };">${q.selectedOption}</span></p>
          ${
            !q.isCorrect
              ? `<p style="margin: 5px 0;">Correct Answer: <span style="color: #16a34a;">${q.correctOption}</span></p>`
              : ""
          }
        </div>
      `
      )
      .join("");

    // Send email using Resend API
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "QuizMaster <onboarding@resend.dev>",
        to: [email],
        subject: `Your Quiz Results: ${quizTitle}`,
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
                  <p>${quizTitle}</p>
                </div>
                <div class="content">
                  <p>Dear ${userName},</p>
                  <p>Congratulations on completing the quiz! Here are your results:</p>
                  
                  <div class="score-card">
                    <div class="score">${score}/${totalQuestions}</div>
                    <div class="percentage">${percentage.toFixed(1)}%</div>
                    <p style="margin: 10px 0 0 0; color: #6b7280;">Time Taken: ${timeTaken}</p>
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
      throw new Error(emailData.message || "Failed to send email");
    }

    console.log("Email sent successfully:", emailData);

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
