import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
const SITE_URL = "https://pecup.in";
serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", {
            headers: corsHeaders
        });
    }
    try {
        const { email, name, branch, year } = await req.json();
        if (!email || !name) {
            return new Response(JSON.stringify({
                error: "Email and name are required"
            }), {
                headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json"
                },
                status: 400
            });
        }
        const { data, error } = await resend.emails.send({
            from: Deno.env.get("RESEND_FROM_EMAIL") || "Pecups <onboarding@pecups.com>",
            to: [
                email
            ],
            subject: "Welcome to PEC.UP!",
            html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to PEC.UP!</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, hsl(210, 40%, 98%) 0%, hsl(214.3, 31.8%, 91.4%) 100%);
            padding: 40px 20px;
            line-height: 1.6;
        }
        .email-wrapper {
            max-width: 640px;
            margin: 0 auto;
            background: hsl(0, 0%, 100%);
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.08);
        }
        .header {
            background: linear-gradient(135deg, hsl(9, 100%, 60%) 0%, hsl(9, 100%, 55%) 100%);
            padding: 60px 40px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        .header::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%);
            animation: pulse 8s ease-in-out infinite;
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 0.5; }
            50% { transform: scale(1.1); opacity: 0.8; }
        }
        .logo {
            font-size: 48px;
            font-weight: 800;
            color: hsl(0, 0%, 100%);
            letter-spacing: -2px;
            margin-bottom: 12px;
            position: relative;
            z-index: 1;
            text-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }
        .tagline {
            color: rgba(255,255,255,0.95);
            font-size: 18px;
            font-weight: 500;
            position: relative;
            z-index: 1;
        }
        .content {
            padding: 50px 40px;
        }
        .greeting {
            font-size: 32px;
            font-weight: 700;
            color: hsl(222.2, 84%, 4.9%);
            margin-bottom: 16px;
            background: linear-gradient(135deg, hsl(9, 100%, 60%) 0%, hsl(9, 100%, 50%) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        .student-info {
            background: linear-gradient(135deg, hsl(0, 0%, 100%) 0%, hsl(210, 40%, 98%) 100%);
            border-left: 4px solid hsl(9, 100%, 60%);
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 32px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 24px;
        }
        .info-item {
            display: flex;
            flex-direction: column;
        }
        .info-label {
            font-size: 12px;
            font-weight: 700;
            color: hsl(9, 100%, 60%);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }
        .info-value {
            font-size: 16px;
            font-weight: 600;
            color: hsl(222.2, 84%, 4.9%);
        }
        .intro {
            font-size: 18px;
            color: hsl(215.4, 16.3%, 46.9%);
            margin-bottom: 40px;
            line-height: 1.7;
        }
        .features {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-bottom: 40px;
        }
        .feature-card {
            background: linear-gradient(135deg, hsl(0, 0%, 100%) 0%, hsl(210, 40%, 98%) 100%);
            border: 2px solid hsl(214.3, 31.8%, 91.4%);
            border-radius: 16px;
            padding: 28px 24px;
            text-align: center;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
        }
        .feature-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, hsl(9, 100%, 60%) 0%, hsl(9, 100%, 55%) 100%);
            opacity: 0;
            transition: opacity 0.3s ease;
            z-index: 0;
        }
        .feature-card:hover {
            transform: translateY(-8px);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.12);
            border-color: hsl(9, 100%, 60%);
        }
        .feature-card:hover::before {
            opacity: 0.05;
        }
        .feature-icon {
            font-size: 40px;
            margin-bottom: 16px;
            position: relative;
            z-index: 1;
            display: none;
        }
        .feature-title {
            font-size: 18px;
            font-weight: 700;
            color: hsl(222.2, 84%, 4.9%);
            margin-bottom: 8px;
            position: relative;
            z-index: 1;
        }
        .feature-title a {
            color: inherit;
            text-decoration: none;
            transition: color 0.3s ease;
        }
        .feature-card:hover .feature-title a {
            color: hsl(9, 100%, 60%);
        }
        .feature-desc {
            font-size: 14px;
            color: hsl(215.4, 16.3%, 46.9%);
            line-height: 1.6;
            position: relative;
            z-index: 1;
        }
        .cta-section {
            background: linear-gradient(135deg, hsl(9, 100%, 60%) 0%, hsl(9, 100%, 55%) 100%);
            border-radius: 16px;
            padding: 40px;
            text-align: center;
            margin-bottom: 40px;
            position: relative;
            overflow: hidden;
        }
        .cta-section::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%);
        }
        .cta-text {
            color: hsl(0, 0%, 100%);
            font-size: 20px;
            font-weight: 600;
            margin-bottom: 24px;
            position: relative;
            z-index: 1;
        }
        .cta-button {
            display: inline-block;
            background: hsl(0, 0%, 100%);
            color: hsl(9, 100%, 60%);
            text-decoration: none;
            padding: 16px 40px;
            border-radius: 50px;
            font-weight: 700;
            font-size: 16px;
            transition: all 0.3s ease;
            position: relative;
            z-index: 1;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
        }
        .cta-button:hover {
            transform: translateY(-2px) scale(1.05);
            box-shadow: 0 15px 40px rgba(0, 0, 0, 0.25);
        }
        .signature {
            font-size: 16px;
            color: hsl(222.2, 84%, 4.9%);
            margin-bottom: 40px;
            padding-left: 20px;
            border-left: 4px solid hsl(9, 100%, 60%);
        }
        .signature-name {
            font-weight: 700;
            margin-top: 8px;
        }
        .footer {
            background: linear-gradient(135deg, hsl(222.2, 84%, 4.9%) 0%, hsl(215, 25%, 15%) 100%);
            padding: 40px;
            text-align: center;
            color: rgba(255,255,255,0.8);
        }
        .footer-title {
            font-size: 18px;
            font-weight: 700;
            color: hsl(0, 0%, 100%);
            margin-bottom: 8px;
        }
        .footer-text {
            font-size: 14px;
            line-height: 1.6;
        }
        @media (max-width: 600px) {
            body {
                padding: 20px 10px;
            }
            .email-wrapper {
                border-radius: 16px;
            }
            .header {
                padding: 40px 24px;
            }
            .logo {
                font-size: 36px;
            }
            .tagline {
                font-size: 16px;
            }
            .content {
                padding: 40px 24px;
            }
            .greeting {
                font-size: 26px;
            }
            .student-info {
                flex-direction: column;
                gap: 16px;
            }
            .intro {
                font-size: 16px;
            }
            .features {
                grid-template-columns: 1fr;
                gap: 16px;
            }
            .cta-section {
                padding: 32px 24px;
            }
            .cta-text {
                font-size: 18px;
            }
            .footer {
                padding: 32px 24px;
            }
        }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="header">
            <div class="logo">PEC.UP</div>
        </div>

        <div class="content">
            <h1 class="greeting">Welcome to PEC.UP, ${name}!</h1>
            
            <p class="intro">
                You've successfully joined PEC.UP, your premier platform for educational resources and peer collaboration at PEC.
            </p>

            <div class="features">
                <div class="feature-card">
                    <h3 class="feature-title"><a href="${SITE_URL}/resources">Resources</a></h3>
                    <p class="feature-desc">Access notes, assignments, papers, and records</p>
                </div>
                
                <div class="feature-card">
                    <h3 class="feature-title"><a href="${SITE_URL}/reminders">Reminders</a></h3>
                    <p class="feature-desc">Stay organized with academic schedules</p>
                </div>
                
                <div class="feature-card">
                    <h3 class="feature-title"><a href="${SITE_URL}/archive">Archive</a></h3>
                    <p class="feature-desc">Browse archived notes and materials</p>
                </div>
                
                <div class="feature-card">
                    <h3 class="feature-title"><a href="${SITE_URL}/contact">Contact</a></h3>
                    <p class="feature-desc">Connect with support and fellow students</p>
                </div>
            </div>

            <div class="cta-section">
                <p class="cta-text">Ready to explore? Your personalized dashboard is just a click away!</p>
                <a href="${SITE_URL}/home" class="cta-button">Go to Dashboard</a>
            </div>

            <div class="signature">
                <div>Thanks,</div>
                <div class="signature-name">Yeswanth Madasu</div>
                <div>PEC.UP Team</div>
            </div>
        </div>

        <div class="footer">
            <p class="footer-title">Need Help?</p>
            <p class="footer-text">Our support team is here for you. Reach out anytime with questions or feedback!</p>
        </div>
    </div>
</body>
</html>`
        });
        if (error) {
            console.error("Resend error:", error);
            return new Response(JSON.stringify({
                error: error.message
            }), {
                headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json"
                },
                status: 400
            });
        }
        return new Response(JSON.stringify(data), {
            headers: {
                ...corsHeaders,
                "Content-Type": "application/json"
            },
            status: 200
        });
    } catch (error) {
        console.error("Function error:", error);
        return new Response(JSON.stringify({
            error: error.message
        }), {
            headers: {
                ...corsHeaders,
                "Content-Type": "application/json"
            },
            status: 500
        });
    }
});
