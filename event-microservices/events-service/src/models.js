const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false
});

const Event = sequelize.define('Event', {
  title: { type: DataTypes.STRING, allowNull: false },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  places_totales: { type: DataTypes.INTEGER, allowNull: false },
  places_dispo: { type: DataTypes.INTEGER, allowNull: false },
  statut: { type: DataTypes.STRING, defaultValue: 'active' }
});

module.exports = { sequelize, Event };
