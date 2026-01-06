const express = require('express');
const axios = require('axios');
const cors = require('cors');
const { sequelize, Reservation } = require('./models');

const EVENTS_URL = process.env.EVENTS_SERVICE_URL || 'http://localhost:3001';
const PAYMENTS_URL = process.env.PAYMENTS_SERVICE_URL || 'http://localhost:3002';

const app = express();
app.use(express.json());
app.use(cors());

app.post('/reservations', async (req, res) => {
  console.log("Reçu demande de réservation:", req.body);
  const { eventId, userId } = req.body;

  if (!eventId || !userId) {
    return res.status(400).json({ error: "eventId et userId sont requis" });
  }

  try {
    // 0. Vérifier si l'utilisateur a déjà réservé cet événement
    const existingReservation = await Reservation.findOne({ where: { eventId, userId } });
    if (existingReservation) {
      console.log(`Doublon détecté pour User ${userId} sur Event ${eventId}`);
      return res.status(409).json({ error: "Vous avez déjà réservé une place pour cet événement." });
    }

    // 1. Vérifier l'événement
    console.log(`Vérification événement ${eventId}...`);
    let event;
    try {
      const eventResponse = await axios.get(`${EVENTS_URL}/events`);
      event = eventResponse.data.find(e => e.id == eventId);
    } catch (err) {
      console.error("Erreur contact service Events:", err.message);
      return res.status(503).json({ error: "Service Événements indisponible" });
    }
    
    if (!event) {
      return res.status(404).json({ error: "Événement inexistant" });
    }
    if (event.places_dispo <= 0) {
      return res.status(400).json({ error: "Événement complet" });
    }

    // 2. Appeler le Service Paiements (Simulation)
    console.log(`Traitement paiement pour User ${userId}...`);
    try {
      await axios.post(`${PAYMENTS_URL}/pay`, { 
        userId, 
        eventId, 
        amount: 100 
      });
    } catch (paymentError) {
      console.log(`[Reservation] ❌ Paiement refusé pour User ${userId}`);
      return res.status(402).json({ error: "Paiement refusé par la banque." });
    }

    // 3. Si Paiement OK -> On VALIDE la réservation
    console.log("Création réservation en base...");
    const reservation = await Reservation.create({
      eventId, userId, status: 'confirmed'
    });

    // 4. Décrémenter le stock
    try {
      await axios.patch(`${EVENTS_URL}/events/${eventId}/decrement`);
    } catch (decrementError) {
      console.error("ERREUR CRITIQUE: Stock non décrémenté", decrementError.message);
    }

    console.log(`[Reservation] ✅ Réservation confirmée pour User ${userId}`);
    res.json({ message: "Réservation confirmée", reservation, eventTitle: event.title, eventDate: event.date });
  } catch (e) {
    console.error("ERREUR SERVEUR RESERVATION:", e);
    res.status(500).json({ error: "Erreur interne du serveur: " + e.message });
  }
});

// Route pour suivre sa réservation
app.get('/reservations/:id', async (req, res) => {
  try {
    const reservation = await Reservation.findByPk(req.params.id);
    if (!reservation) return res.status(404).json({ error: "Réservation non trouvée" });
    res.json(reservation);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Route pour lister les réservations d'un utilisateur
app.get('/reservations/user/:userId', async (req, res) => {
  try {
    const reservations = await Reservation.findAll({ where: { userId: req.params.userId } });
    res.json(reservations);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = 3003;
sequelize.sync({ alter: true }).then(() => { // alter: true permet de mettre à jour la table si le modèle change
  console.log('DB Reservations Synced');
  app.listen(PORT, () => console.log(`Reservations running on port ${PORT}`));
});
