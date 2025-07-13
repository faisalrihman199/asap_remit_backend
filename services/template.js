exports.getEmailTemplate = (otp, expiresInMinutes = 5) => `
  <div style="background-color: #f1f4f9;  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
    <div style="max-width: 600px; margin: auto; background-color: #ffffff; border-radius: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); overflow: hidden;">
      <div style="background-color: #0052cc; padding: 20px 30px;">
        <h1 style="color: #ffffff; margin: 0; font-size: 24px;">ASAP Remit</h1>
        <p style="color: #cfe0ff; margin: 5px 0 0;">Secure Verification Code</p>
      </div>
      <div style="padding: 30px;">
        <p style="font-size: 16px; color: #333333;">Hello,</p>
        <p style="font-size: 15px; color: #444;">To continue with your secure action, please use the verification code below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="display: inline-block; font-size: 28px; font-weight: bold; color: #0052cc; letter-spacing: 3px;">
            ${otp}
          </span>
        </div>
        <p style="font-size: 14px; color: #777;">This code is valid for <strong>${expiresInMinutes} minutes</strong>. Please do not share it with anyone.</p>
        <p style="font-size: 14px; color: #999; margin-top: 30px;">If you didn’t request this code, you can safely ignore this message.</p>
        <p style="font-size: 15px; color: #333; margin-top: 20px;">Warm regards,<br><strong>ASAP Remit Team</strong></p>
      </div>
      <div style="background-color: #f7f7f7; padding: 20px; text-align: center; font-size: 12px; color: #888;">
        &copy; ${new Date().getFullYear()} ASAP Remit. All rights reserved.
      </div>
    </div>
  </div>
`;

exports.getSmsTemplate = (otp, expiresInMinutes = 5) =>
  `Your ASAP Remit OTP is: ${otp}. Valid for ${expiresInMinutes} minutes. Never share this code with anyone.`;
