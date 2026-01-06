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
  const { eventId, userId } = req.body;
  try {
    // 1. Vérifier l'événement
    const eventResponse = await axios.get(`${EVENTS_URL}/events`);
    const event = eventResponse.data.find(e => e.id == eventId);
    
    if (!event || event.places_dispo <= 0) {
      return res.status(400).json({ error: "Complet ou inexistant" });
    }

    // 2. Appeler le Service Paiements (Simulation)
    // Le service paiement va "valider ou refuser" la transaction
    try {
      await axios.post(`${PAYMENTS_URL}/pay`, { 
        userId, 
        eventId, // On envoie l'ID de l'event pour la traçabilité
        amount: 100 
      });
    } catch (paymentError) {
      // Si le paiement échoue (402), on REFUSE la réservation
      console.log(`[Reservation] ❌ Paiement refusé pour User ${userId}`);
      return res.status(402).json({ error: "Paiement refusé, réservation annulée." });
    }

    // 3. Si Paiement OK -> On VALIDE la réservation
    const reservation = await Reservation.create({
      eventId, userId, status: 'confirmed'
    });

    // 4. Décrémenter le stock
    try {
      await axios.patch(`${EVENTS_URL}/events/${eventId}/decrement`);
    } catch (decrementError) {
      console.error("ERREUR CRITIQUE: Stock non décrémenté");
    }

    console.log(`[Reservation] ✅ Réservation confirmée pour User ${userId}`);
    res.json({ message: "Réservation confirmée", reservation });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erreur serveur" });
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
sequelize.sync().then(() => {
  app.listen(PORT, () => console.log(`Reservations running on port ${PORT}`));
});
