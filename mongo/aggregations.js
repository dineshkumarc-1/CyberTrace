// mongosh example. Replace the placeholder with a real authorized demo incident UUID.
const incidentId = "REPLACE_WITH_INCIDENT_UUID";
db.incident_logs.aggregate([
  { $match: { incident_id: incidentId } },
  {
    $group: {
      _id: "$event_type",
      total: { $sum: 1 },
      first_seen: { $min: "$event_time" },
      last_seen: { $max: "$event_time" },
    },
  },
  { $sort: { total: -1 } },
]);
db.incident_logs
  .find({ incident_id: incidentId })
  .sort({ event_time: -1 })
  .limit(15);
db.incident_logs.getIndexes();
db.investigation_reports.getIndexes();
// Invalid data test (expected validation failure, not successful data):
// db.incident_logs.insertOne({incident_id:incidentId,message:42});
