const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmail=async({to,subject,body})=>{
const response=await transporter.sendMail({
    from:process.env.SEMDER_EMAIL , 
    to ,
    subject ,
    html:body, 
  });

  return response
}

export default sendEmail

