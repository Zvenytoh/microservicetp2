const express = require('express');
const app = express();
app.use(express.json());

// Simulation d'un système de paiement externe (Mock)
app.post('/pay', (req, res) => {
  const { userId, amount, eventId } = req.body;
  
  console.log(`\n[Payment Service] Traitement du paiement...`);
  console.log(`User: ${userId} | Event: ${eventId} | Montant: ${amount}€`);

  // Simulation de latence réseau (comme une vraie banque)
  setTimeout(() => {
    // Simulation : 80% de chance de succès (Solvabilité)
    const success = Math.random() > 0.2; 

    if (success) {
      console.log(`[Payment Service] Paiement ACCEPTÉ. Réservation validée.`);
      return res.json({ 
        status: "confirmed", 
        transactionId: "TX_" + Date.now(),
        message: "Paiement autorisé, réservation validée."
      });
    } else {
      console.log(`[Payment Service] Paiement REFUSÉ. Réservation rejetée.`);
      return res.status(402).json({ 
        status: "declined", 
        error: "Fonds insuffisants ou carte refusée." 
      });
    }
  }, 500); // 500ms de délai simulé
});

const PORT = 3002;
app.listen(PORT, () => console.log(`Payments Service (Mock) running on port ${PORT}`));
