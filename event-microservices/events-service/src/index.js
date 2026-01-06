const express = require('express');
const cors = require('cors');
const { sequelize, Event } = require('./models');

const app = express();
app.use(express.json());
app.use(cors());

app.get('/events', async (req, res) => {
  try {
    const events = await Event.findAll();
    res.json(events);
  } catch (e) { 
    console.error("Error fetching events:", e);
    res.status(500).json({ error: e.message }); 
  }
});

app.post('/events', async (req, res) => {
  try {
    console.log("Received create event request:", req.body);
    const { title, date, places_totales } = req.body;
    
    if (!title || !date || !places_totales) {
      return res.status(400).json({ error: "Tous les champs sont obligatoires" });
    }

    const event = await Event.create({
      title, 
      date, 
      places_totales: parseInt(places_totales), 
      places_dispo: parseInt(places_totales)
    });
    console.log("Event created:", event.toJSON());
    res.json(event);
  } catch (e) { 
    console.error("Error creating event:", e);
    res.status(500).json({ error: e.message }); 
  }
});

app.patch('/events/:id/decrement', async (req, res) => {
  try {
    const event = await Event.findByPk(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });
    
    if (event.places_dispo <= 0) {
      return res.status(400).json({ error: "Sold out" });
    }

    event.places_dispo -= 1;
    await event.save();
    res.json({ success: true, new_stock: event.places_dispo });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Route pour modifier le statut (report ou annulation)
app.patch('/events/:id/status', async (req, res) => {
  try {
    const { statut } = req.body; // 'active', 'cancelled', 'postponed'
    const event = await Event.findByPk(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found" });

    event.statut = statut;
    await event.save();
    res.json(event);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = 3001;
sequelize.sync().then(() => {
  console.log('DB Events Synced');
  app.listen(PORT, () => console.log(`Events Service running on port ${PORT}`));
});
