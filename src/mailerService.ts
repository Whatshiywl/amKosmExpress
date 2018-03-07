var sgMail = require('@sendgrid/mail');
var path = require('path');

export class MailerService {

  constructor() {
    var pathToData = path.resolve(__dirname, '../data');
    var mailConfig = require(path.resolve(pathToData, 'mailConfig.json'));
    if(!mailConfig) {
      console.error("Error loading mail api key");
      return;
    }
    var key = mailConfig.sendgridApiKey;
    if(!key) {
      console.error("Error loading mail api key");
      return;
    }
    sgMail.setApiKey(key);
  }

  sendConfirmSignUp(to, name, cpf, confirm) {
    let confirmLink = `http://localhost:9999/sign-up/confirm?cpf=${cpf}&confirm=${confirm}`;
    let msg = {
      to: to,
      from: 'noreply@amandacosmeticos.com',
      subject: 'Confirmação de registro',
      html: `
      <h1>Olá ${name},</h1>
      <h2>Obrigado por se registrar com a Amanda Cosméticos!</h2>
      <p>Para confirmar seu email, favor clicar no link abaixo:</p>
      <a href="${confirmLink}">${confirmLink}</a>
      `,
    };
    sgMail.send(msg);
  }

}

export default new MailerService();