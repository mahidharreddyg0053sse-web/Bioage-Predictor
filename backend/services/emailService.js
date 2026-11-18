const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initTransporter();
  }

  initTransporter() {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '465', 10);
    const user = process.env.SMTP_USER || process.env.EMAIL_USER;
    const pass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
    const service = process.env.EMAIL_SERVICE;
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;

    if (user && pass) {
      const config = service && service.toLowerCase() === 'gmail'
        ? {
            service: 'gmail',
            auth: { user, pass },
            connectionTimeout: 8000,
            greetingTimeout: 8000,
            socketTimeout: 8000
          }
        : {
            host,
            port,
            secure,
            auth: { user, pass },
            connectionTimeout: 8000,
            greetingTimeout: 8000,
            socketTimeout: 8000
          };

      try {
        this.transporter = nodemailer.createTransport(config);
        console.log(`📧 Email Service initialized with SMTP (${service || host || 'smtp.gmail.com'})`);
      } catch (err) {
        console.warn('⚠️ Could not initialize SMTP transporter:', err.message);
        this.transporter = null;
      }
    } else {
      console.log('ℹ️ Email Service running in Development/Console mode (Configure SMTP or RESEND_API_KEY in .env for live inbox delivery).');
    }
  }

  // Dispatch via Resend HTTPS REST API (Port 443 - works on mobile hotspots and networks where ports 465/587 are blocked)
  async sendViaResend(toEmail, otpCode, displayName, htmlTemplate) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return null;

    const fromAddress = process.env.RESEND_FROM || process.env.EMAIL_FROM || 'BioAge Pro Security <onboarding@resend.dev>';
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [toEmail],
        subject: `${otpCode} is your BioAge Pro Password Reset Verification Code`,
        html: htmlTemplate
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Resend API error (status ${res.status})`);
    }
    return { success: true, service: 'Resend (HTTPS)' };
  }

  // Dispatch via Brevo HTTPS REST API (Port 443)
  async sendViaBrevo(toEmail, otpCode, displayName, htmlTemplate) {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) return null;

    const senderEmail = process.env.BREVO_SENDER || process.env.SMTP_USER || 'no-reply@bioagepro.com';
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: 'BioAge Pro Security', email: senderEmail },
        to: [{ email: toEmail, name: displayName }],
        subject: `${otpCode} is your BioAge Pro Password Reset Verification Code`,
        htmlContent: htmlTemplate
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || `Brevo API error (status ${res.status})`);
    }
    return { success: true, service: 'Brevo (HTTPS)' };
  }

  async sendOTPEmail(toEmail, otpCode, userName = 'Valued Member') {
    const recipient = (toEmail || '').trim();
    const displayName = userName && userName !== 'Valued Member' ? userName : 'BioAge Pro User';

    // Log OTP to server console (secure backend log for developer inspection)
    console.log(`\n╔════════════════════════════════════════════════════════════╗`);
    console.log(`║ 🔐 BIOAGE PRO — ONE-TIME PASSWORD (OTP) DISPATCH          ║`);
    console.log(`╠════════════════════════════════════════════════════════════╣`);
    console.log(`║ Recipient : ${recipient.padEnd(46)} ║`);
    console.log(`║ OTP Code  : ${otpCode.padEnd(46)} ║`);
    console.log(`║ Validity  : 10 minutes (Resend allowed in 60s)             ║`);
    console.log(`║ Timestamp : ${new Date().toLocaleTimeString().padEnd(46)} ║`);
    console.log(`╚════════════════════════════════════════════════════════════╝\n`);

    const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
        .container { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 24px; text-align: center; border-bottom: 3px solid #0284c7; }
        .logo-text { font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
        .logo-accent { color: #38bdf8; }
        .content { padding: 36px 30px; }
        .greeting { font-size: 18px; font-weight: 600; color: #0f172a; margin-bottom: 12px; }
        .body-text { font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
        .otp-container { text-align: center; margin: 30px 0; }
        .otp-code { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #0284c7; background: #f0f9ff; border: 2px dashed #38bdf8; border-radius: 12px; padding: 18px 24px; display: inline-block; }
        .notice-badge { background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 6px; font-size: 13px; color: #991b1b; margin: 24px 0; }
        .footer { background: #f8fafc; padding: 20px 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo-text">BioAge<span class="logo-accent">Pro</span></div>
          <div style="color: #94a3b8; font-size: 13px; margin-top: 6px;">Longevity & Biological Age Intelligence</div>
        </div>
        <div class="content">
          <div class="greeting">Hello ${displayName},</div>
          <p class="body-text">We received a request to verify your identity for your BioAge Pro account. Please use the 6-digit verification code below to authorize your request:</p>
          
          <div class="otp-container">
            <div class="otp-code">${otpCode}</div>
          </div>
          
          <div class="notice-badge">
            <strong>Important:</strong> This verification code is valid for <strong>10 minutes</strong>. Never share this code with anyone.
          </div>

          <p class="body-text" style="font-size: 13px; color: #64748b; margin-top: 20px;">
            If you did not request this verification code, you can safely disregard this email. Your account credentials remain secure.
          </p>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} BioAge Pro Platform. Advanced Biometric Clinical Systems.
        </div>
      </div>
    </body>
    </html>
    `;

    let delivered = false;
    let deliveryMethod = null;
    let lastError = null;

    // 1. Try Resend HTTPS REST API if configured
    if (process.env.RESEND_API_KEY) {
      try {
        const result = await this.sendViaResend(recipient, otpCode, displayName, htmlTemplate);
        if (result && result.success) {
          console.log(`✅ Live email delivered successfully via Resend (HTTPS) to ${recipient}`);
          delivered = true;
          deliveryMethod = 'Resend (HTTPS)';
        }
      } catch (err) {
        console.warn(`⚠️ Resend HTTPS delivery error: ${err.message}`);
        lastError = err.message;
      }
    }

    // 2. Try Brevo HTTPS REST API if configured
    if (!delivered && process.env.BREVO_API_KEY) {
      try {
        const result = await this.sendViaBrevo(recipient, otpCode, displayName, htmlTemplate);
        if (result && result.success) {
          console.log(`✅ Live email delivered successfully via Brevo (HTTPS) to ${recipient}`);
          delivered = true;
          deliveryMethod = 'Brevo (HTTPS)';
        }
      } catch (err) {
        console.warn(`⚠️ Brevo HTTPS delivery error: ${err.message}`);
        lastError = err.message;
      }
    }

    // 3. Try Nodemailer SMTP (Works on broadband Wi-Fi, Cloud hosts, and unblocked connections)
    if (!delivered && this.transporter) {
      try {
        const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.EMAIL_USER || 'no-reply@bioagepro.com';
        await this.transporter.sendMail({
          from: `"BioAge Pro Security" <${fromAddress}>`,
          to: recipient,
          subject: `${otpCode} is your BioAge Pro Password Reset Verification Code`,
          text: `Your BioAge Pro password reset verification code is: ${otpCode}. It is valid for 10 minutes.`,
          html: htmlTemplate
        });

        console.log(`✅ Live SMTP email delivered successfully to ${recipient}`);
        delivered = true;
        deliveryMethod = 'SMTP';
      } catch (err) {
        console.warn(`⚠️ SMTP dispatch error: ${err.message}`);
        lastError = err.message;
      }
    }

    if (!delivered) {
      // Build a helpful diagnostic message explaining why delivery failed
      const isPortBlocked = lastError && (lastError.includes('ETIMEDOUT') || lastError.includes('ENETUNREACH') || lastError.includes('ECONNREFUSED'));
      let userFriendlyError = 'Could not deliver verification email.';
      if (isPortBlocked) {
        userFriendlyError = `SMTP connection to mail server timed out. Your current Wi-Fi/cellular hotspot is blocking outbound email ports (465/587). Please connect to a broadband Wi-Fi network, or add a free RESEND_API_KEY to .env for HTTPS email delivery.`;
      } else if (lastError) {
        userFriendlyError = `Email delivery error: ${lastError}`;
      } else {
        userFriendlyError = `No email transport configured. Please configure SMTP or RESEND_API_KEY in .env.`;
      }

      return {
        success: false,
        deliveryMethod: null,
        error: userFriendlyError,
        rawError: lastError
      };
    }

    return {
      success: true,
      deliveryMethod,
      error: null
    };
  }
}

module.exports = new EmailService();
