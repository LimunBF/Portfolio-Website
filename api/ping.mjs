export default {
  fetch() {
    return Response.json({
      ok: true,
      message: "Vercel Function works"
    });
  }
};