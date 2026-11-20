import { mongo } from "../lib/db";
export async function setupMongo() {
  const db = await mongo();
  const schemas: any = {
    investigation_reports: {
      bsonType: "object",
      required: [
        "incident_id",
        "summary",
        "detailed_report",
        "analyst_notes",
        "remediation_summary",
        "author_id",
        "version",
        "created_at",
        "updated_at",
      ],
      properties: {
        incident_id: { bsonType: "string", pattern: "^[0-9a-f-]{36}$" },
        summary: { bsonType: "string", minLength: 5, maxLength: 2000 },
        detailed_report: {
          bsonType: "string",
          minLength: 10,
          maxLength: 30000,
        },
        remediation_summary: { bsonType: "string", maxLength: 5000 },
        author_id: { bsonType: "string" },
        version: { bsonType: ["int", "double"], minimum: 1 },
        created_at: { bsonType: "date" },
        updated_at: { bsonType: "date" },
        analyst_notes: {
          bsonType: "array",
          items: {
            bsonType: "object",
            required: ["author_id", "text", "created_at"],
            properties: {
              author_id: { bsonType: "string" },
              text: { bsonType: "string", maxLength: 3000 },
              created_at: { bsonType: "date" },
            },
          },
        },
      },
    },
    incident_logs: {
      bsonType: "object",
      required: [
        "incident_id",
        "event_type",
        "event_time",
        "message",
        "raw_data",
      ],
      properties: {
        incident_id: { bsonType: "string", pattern: "^[0-9a-f-]{36}$" },
        event_type: { bsonType: "string", minLength: 2, maxLength: 100 },
        event_time: { bsonType: "date" },
        source_ip: { bsonType: "string" },
        message: { bsonType: "string", minLength: 1, maxLength: 4000 },
        raw_data: { bsonType: "object" },
      },
    },
  };
  for (const [name, schema] of Object.entries(schemas)) {
    const validator = { $jsonSchema: schema };
    if ((await db.listCollections({ name }).toArray()).length)
      await db.command({
        collMod: name,
        validator,
        validationLevel: "strict",
        validationAction: "error",
      });
    else
      await db.createCollection(name, {
        validator,
        validationLevel: "strict",
        validationAction: "error",
      });
  }
  await db
    .collection("investigation_reports")
    .createIndex({ incident_id: 1, updated_at: -1 });
  await db
    .collection("incident_logs")
    .createIndex({ incident_id: 1, event_time: -1 });
  await db
    .collection("incident_logs")
    .createIndex({ incident_id: 1, event_type: 1 });
}
