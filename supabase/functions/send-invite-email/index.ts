import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface InviteEmailRequest {
  email: string;
  role: string;
  inviterName?: string;
  affiliateName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the request is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { email, role, inviterName, affiliateName }: InviteEmailRequest = await req.json();

    console.log(`Sending invite email to ${email} for role ${role}`);

    const appUrl = req.headers.get("origin") || "https://app.example.com";
    const signupUrl = `${appUrl}/auth`;

    const roleDescription = role === "affiliate" && affiliateName
      ? `${role} partner for ${affiliateName}`
      : role;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 20px; }
            .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
            h1 { color: #18181b; font-size: 24px; margin: 0 0 16px; }
            p { color: #52525b; font-size: 16px; line-height: 1.6; margin: 0 0 16px; }
            .highlight { background: #f0fdf4; border-left: 4px solid #22c55e; padding: 12px 16px; margin: 24px 0; border-radius: 0 8px 8px 0; }
            .highlight p { margin: 0; color: #166534; }
            .button { display: inline-block; background: #18181b; color: white !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 24px 0; }
            .footer { margin-top: 32px; padding-top: 24px; border-top: 1px solid #e4e4e7; color: #a1a1aa; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>You're Invited!</h1>
            <p>${inviterName ? `${inviterName} has` : "You've been"} invited you to join Stakemate as a <strong>${roleDescription}</strong>.</p>
            
            <div class="highlight">
              <p>Sign up with this email address (<strong>${email}</strong>) to accept the invitation and get started.</p>
            </div>
            
            <a href="${signupUrl}" class="button">Accept Invitation</a>
            
            <p>If you didn't expect this invitation, you can safely ignore this email.</p>
            
            <div class="footer">
              <p>This invitation expires in 7 days.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Stakemate <onboarding@resend.dev>",
        to: [email],
        subject: "You've been invited to Stakemate",
        html: emailHtml,
      }),
    });

    const emailResult = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("Resend API error:", emailResult);
      throw new Error(emailResult.message || "Failed to send email");
    }

    console.log("Email sent successfully:", emailResult);

    return new Response(JSON.stringify({ success: true, data: emailResult }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending invite email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
