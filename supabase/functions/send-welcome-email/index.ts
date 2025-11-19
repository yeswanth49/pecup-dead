import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

interface WelcomeEmailRequest {
    email: string;
    name: string;
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const { email, name }: WelcomeEmailRequest = await req.json();

        if (!email || !name) {
            return new Response(
                JSON.stringify({ error: "Email and name are required" }),
                {
                    headers: { ...corsHeaders, "Content-Type": "application/json" },
                    status: 400,
                }
            );
        }

        const { data, error } = await resend.emails.send({
            from: Deno.env.get("RESEND_FROM_EMAIL") || "Pecups <onboarding@pecups.com>",
            to: [email],
            subject: "Welcome to PEC.UP!",
            html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to PEC.UP!</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background-color: #f8fafc;
            color: #334155;
            line-height: 1.6;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #dc2626 0%, #ea580c 100%);
            padding: 32px 24px;
            text-align: center;
            color: #ffffff;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
            letter-spacing: -0.025em;
        }
        .content {
            padding: 40px 32px;
        }
        .welcome-message {
            font-size: 18px;
            color: #475569;
            margin: 0 0 24px 0;
            font-weight: 600;
        }
        .greeting {
            font-size: 24px;
            font-weight: 700;
            color: #1e293b;
            margin: 0 0 16px 0;
        }
        .feature-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
            margin: 32px 0;
        }
        .feature-item {
            text-align: center;
            padding: 20px;
            background-color: #f8fafc;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
        }
        .feature-icon {
            font-size: 32px;
            color: #dc2626;
            margin-bottom: 12px;
        }
        .feature-title {
            font-size: 16px;
            font-weight: 600;
            color: #334155;
            margin: 0;
        }
        .cta-section {
            text-align: center;
            margin: 40px 0 32px 0;
        }
        .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #dc2626 0%, #ea580c 100%);
            color: #ffffff !important;
            text-decoration: none;
            padding: 14px 28px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            transition: transform 0.2s ease;
        }
        .footer {
            background-color: #f8fafc;
            padding: 32px 24px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
        }
        .footer-content p {
            margin: 0 0 8px 0;
            color: #64748b;
            font-size: 14px;
        }
        .signature {
            font-weight: 600;
            color: #334155;
        }
        @media (max-width: 480px) {
            .container {
                margin: 0 16px;
            }
            .header {
                padding: 24px 20px;
            }
            .header h1 {
                font-size: 24px;
            }
            .content {
                padding: 32px 24px;
            }
            .feature-grid {
                grid-template-columns: 1fr;
                gap: 16px;
            }
            .greeting {
                font-size: 20px;
            }
        }
    </style>
</head>
<body>
    <div style="padding: 20px;">
        <div class="container">
            <!-- Header -->
            <div class="header">
                <h1>🎓 Welcome to PEC.UP!</h1>
            </div>

            <!-- Content -->
            <div class="content">
                <div class="welcome-message">Hello ${name}!</div>
                <h2 class="greeting">Welcome to PEC.UP! We're excited to have you join our community.</h2>

                <p style="font-size: 16px; color: #475569; margin-bottom: 24px;">
                    You've successfully joined PEC.UP, your premier platform for educational resources and peer collaboration at PEC.
                </p>

                <div class="feature-grid">
                    <div class="feature-item">
                        <div class="feature-icon">📚</div>
                        <h3 class="feature-title">Academic Resources</h3>
                        <p style="font-size: 14px; color: #64748b; margin: 8px 0 0 0;">Access study materials, notes, and academic content</p>
                    </div>
                    <div class="feature-item">
                        <div class="feature-icon">👥</div>
                        <h3 class="feature-title">Connect & Collaborate</h3>
                        <p style="font-size: 14px; color: #64748b; margin: 8px 0 0 0;">Join discussions and connect with your peers</p>
                    </div>
                    <div class="feature-item">
                        <div class="feature-icon">📋</div>
                        <h3 class="feature-title">Stay Updated</h3>
                        <p style="font-size: 14px; color: #64748b; margin: 8px 0 0 0;">Get notified about important announcements and events</p>
                    </div>
                    <div class="feature-item">
                        <div class="feature-icon">📅</div>
                        <h3 class="feature-title">Organize Better</h3>
                        <p style="font-size: 14px; color: #64748b; margin: 8px 0 0 0;">Manage your academic schedule and reminders</p>
                    </div>
                </div>

                <div class="cta-section">
                    <p style="font-size: 16px; color: #475569; margin-bottom: 24px;">
                        Ready to get started? Log in to your dashboard and explore all the features we have prepared for you.
                    </p>
                    <a href="#" class="cta-button">Go to Dashboard</a>
                </div>
            </div>

            <!-- Footer -->
            <div class="footer">
                <div class="footer-content">
                    <p>This is an automated message. Please do not reply to this email.</p>
                    <p><strong>Need help?</strong> Contact our support team if you have any questions.</p>
                    <p class="signature">Best regards,<br>The PEC.UP Team</p>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`,
        });

        if (error) {
            console.error("Resend error:", error);
            return new Response(JSON.stringify({ error: error.message }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 400,
            });
        }

        return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error) {
        console.error("Function error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500,
        });
    }
});
