const { Sequelize, DataTypes } = require('sequelize');
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres', logging: false
});
const Reservation = sequelize.define('Reservation', {
  eventId: DataTypes.INTEGER,
  userId: DataTypes.STRING,
  status: DataTypes.STRING 
});
module.exports = { sequelize, Reservation };
