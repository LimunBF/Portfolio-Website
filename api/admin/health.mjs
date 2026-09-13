export default {
  async fetch() {
    return Response.json({
      ok: true,
      message: "Admin API runtime works"
    });
  }
};