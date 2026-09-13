import {
  getDb
} from "../../lib/firebase.mjs";

export default {
  async fetch() {
    try {
      const db = getDb();

      const snapshot = await db
        .collection("guestbook_notes")
        .limit(5)
        .get();

      return Response.json({
        ok: true,
        count: snapshot.size
      });

    } catch (error) {
      console.error("Firebase test:", error);

      return Response.json(
        {
          ok: false,
          message: error?.message || "Firebase failed"
        },
        {
          status: 500
        }
      );
    }
  }
};