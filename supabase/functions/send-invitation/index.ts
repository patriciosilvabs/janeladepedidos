import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface InvitationRequest {
  email: string;
  role: "admin" | "user";
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Create Supabase client with user's token
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create client with user token to verify permissions
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user is owner
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error("User auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Use service role to check if user is owner
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: isOwner } = await supabaseAdmin.rpc("has_role", {
      _user_id: user.id,
      _role: "owner",
    });

    if (!isOwner) {
      return new Response(
        JSON.stringify({ error: "Only owners can send invitations" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Parse request body
    const { email, role }: InvitationRequest = await req.json();

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUsers?.users?.some(u => u.email === email);
    
    if (userExists) {
      return new Response(
        JSON.stringify({ error: "Este email já está cadastrado no sistema" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Check for existing pending invitation
    const { data: existingInvite } = await supabaseAdmin
      .from("invitations")
      .select("id, used_at, expires_at")
      .eq("email", email)
      .maybeSingle();

    let invitationToken: string;

    if (existingInvite) {
      if (existingInvite.used_at) {
        return new Response(
          JSON.stringify({ error: "Este email já foi convidado e já criou uma conta" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      
      // Update existing invitation
      const { data: updatedInvite, error: updateError } = await supabaseAdmin
        .from("invitations")
        .update({
          role,
          invited_by: user.id,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", existingInvite.id)
        .select("token")
        .single();

      if (updateError) {
        console.error("Error updating invitation:", updateError);
        throw updateError;
      }
      invitationToken = updatedInvite.token;
    } else {
      // Create new invitation
      const { data: newInvite, error: insertError } = await supabaseAdmin
        .from("invitations")
        .insert({
          email,
          role,
          invited_by: user.id,
        })
        .select("token")
        .single();

      if (insertError) {
        console.error("Error creating invitation:", insertError);
        throw insertError;
      }
      invitationToken = newInvite.token;
    }

    // Get base URL from environment or use default
    const baseUrl = Deno.env.get("PUBLIC_SITE_URL") || "https://batch-and-dispatch.lovable.app";
    const inviteLink = `${baseUrl}/invite?token=${invitationToken}`;

    console.log("Sending invitation email to:", email);
    console.log("Invite link:", inviteLink);

    // Send email via Resend API
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Buffer Logístico <onboarding@resend.dev>",
        to: [email],
        subject: "Você foi convidado para o Buffer Logístico",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <div style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <div style="text-align: center; margin-bottom: 30px;">
                  <div style="width: 60px; height: 60px; background-color: #3b82f6; border-radius: 12px; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                    <span style="font-size: 30px;">🚚</span>
                  </div>
                  <h1 style="color: #18181b; font-size: 24px; margin: 0;">Você foi convidado!</h1>
                </div>
                
                <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
                  Você foi convidado para fazer parte do <strong>Buffer Logístico</strong> como <strong>${role === 'admin' ? 'Administrador' : 'Usuário'}</strong>.
                </p>
                
                <p style="color: #52525b; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                  Clique no botão abaixo para criar sua conta:
                </p>
                
                <div style="text-align: center; margin-bottom: 30px;">
                  <a href="${inviteLink}" style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                    Criar minha conta
                  </a>
                </div>
                
                <p style="color: #a1a1aa; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
                  Se o botão não funcionar, copie e cole o link abaixo no seu navegador:
                </p>
                
                <p style="color: #3b82f6; font-size: 14px; word-break: break-all; background-color: #f4f4f5; padding: 12px; border-radius: 6px;">
                  ${inviteLink}
                </p>
                
                <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 30px 0;">
                
                <p style="color: #a1a1aa; font-size: 12px; text-align: center;">
                  Este convite expira em 7 dias. Se você não solicitou este convite, pode ignorar este email.
                </p>
              </div>
            </div>
          </body>
          </html>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      console.error("Resend API error:", errorData);
      throw new Error(errorData.message || "Erro ao enviar email");
    }

    const emailResult = await emailResponse.json();
    console.log("Email sent successfully:", emailResult);

    return new Response(
      JSON.stringify({ success: true, message: "Convite enviado com sucesso" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-invitation function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro ao enviar convite" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
