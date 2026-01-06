const express = require('express');
const axios = require('axios');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { sequelize, Reservation } = require('./models');

const EVENTS_URL = process.env.EVENTS_SERVICE_URL || 'http://localhost:3001';
const PAYMENTS_URL = process.env.PAYMENTS_SERVICE_URL || 'http://localhost:3002';
const USERS_URL = process.env.USERS_SERVICE_URL || 'http://service-users:3004'; 

const app = express();
app.use(express.json());
app.use(cors());

let transporter;
async function initMailer() {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (!smtpUser || !smtpPass) return;

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: smtpUser, pass: smtpPass }
  });
  try {
    await transporter.verify();
    console.log('Service Mail prêt (Gmail Service)');
  } catch (error) {
    console.error('Erreur Mail:', error.message);
  }
}
initMailer();

async function sendConfirmationEmail(userEmail, userName, eventTitle, eventDate, reservationId) {
  if (!transporter) return;
  try {
    await transporter.sendMail({
      from: `"EventTix" <${process.env.SMTP_USER}>`,
      to: userEmail,
      subject: `Votre billet pour ${eventTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #ffffff; margin: 0; padding: 0; -webkit-font-smoothing: antialiased; }
            .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
            .header { margin-bottom: 40px; text-align: center; }
            .logo { font-weight: 700; font-size: 20px; letter-spacing: -0.5px; color: #000; text-decoration: none; }
            .content { background: #ffffff; }
            h1 { font-size: 32px; font-weight: 700; letter-spacing: -1px; margin-bottom: 8px; color: #000; }
            .subtitle { font-size: 16px; color: #666; margin-bottom: 40px; }
            .ticket-card { border: 1px solid #e5e5e5; border-radius: 12px; padding: 24px; margin-bottom: 40px; }
            .label { font-size: 12px; font-weight: 600; text-transform: uppercase; color: #999; letter-spacing: 0.5px; margin-bottom: 4px; }
            .value { font-size: 16px; font-weight: 500; color: #000; margin-bottom: 20px; }
            .footer { border-top: 1px solid #e5e5e5; padding-top: 24px; font-size: 12px; color: #999; text-align: center; }
            .btn { display: inline-block; background: #000; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500; font-size: 14px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <span class="logo">EventTix</span>
            </div>
            <div class="content">
              <h1>C'est confirmé.</h1>
              <p class="subtitle">Votre réservation a été validée. Voici les détails de votre billet numérique.</p>
              
              <div class="ticket-card">
                <div class="label">Événement</div>
                <div class="value">${eventTitle}</div>
                
                <div style="display: flex; justify-content: space-between;">
                  <div style="flex: 1;">
                    <div class="label">Date</div>
                    <div class="value">${eventDate}</div>
                  </div>
                  <div style="flex: 1;">
                    <div class="label">N° de Billet</div>
                    <div class="value">#${reservationId}</div>
                  </div>
                </div>

                <div class="label">Détenteur</div>
                <div class="value">${userName}</div>
              </div>

              <p style="font-size: 14px; color: #666; line-height: 1.5;">
                Veuillez présenter ce mail ou votre QR code disponible dans votre espace client lors de votre arrivée à l'événement.
              </p>
              
              <center>
                <a href="http://localhost:3000" class="btn">Accéder à mes billets</a>
              </center>
            </div>
            <div class="footer">
              &copy; 2024 EventTix Inc. Tous droits réservés.
            </div>
          </div>
        </body>
        </html>
      `
    });
    console.log(`[Email] Succès : Mail envoyé à ${userEmail}`);
  } catch (e) {
    console.error(`[Email] Erreur : ${e.message}`);
  }
}

app.post('/reservations', async (req, res) => {
  const { eventId, userId } = req.body;
  try {
    const existingReservation = await Reservation.findOne({ where: { eventId, userId } });
    if (existingReservation) return res.status(409).json({ error: "Déjà réservé." });

    const eventResponse = await axios.get(`${EVENTS_URL}/events`);
    const event = eventResponse.data.find(e => e.id == eventId);
    if (!event || event.places_dispo <= 0) return res.status(400).json({ error: "Indisponible." });

    await axios.post(`${PAYMENTS_URL}/pay`, { userId, eventId, amount: 100 });

    const reservation = await Reservation.create({ eventId, userId, status: 'confirmed' });
    await axios.patch(`${EVENTS_URL}/events/${eventId}/decrement`);

    axios.get(`${USERS_URL}/profile/${userId}`).then(userRes => {
      if (userRes.data.email) {
        sendConfirmationEmail(userRes.data.email, userRes.data.username, event.title, event.date, reservation.id);
      }
    }).catch(e => console.error("Erreur récup user pour mail:", e.message));

    res.json({ message: "Réservation confirmée", reservation, eventTitle: event.title, eventDate: event.date });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/reservations/user/:userId', async (req, res) => {
  try {
    const reservations = await Reservation.findAll({ where: { userId: req.params.userId } });
    res.json(reservations);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = 3003;
sequelize.sync().then(() => {
  app.listen(PORT, () => console.log(`Reservations running on port ${PORT}`));
});
