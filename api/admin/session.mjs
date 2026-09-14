import {
  AdminAuthError,
  verifyAdminRequest
} from "../../lib/admin-auth.mjs";


function json(
  data,
  status = 200
) {
  return Response.json(
    data,
    {
      status,

      headers: {
        "Cache-Control":
          "no-store",

        "X-Content-Type-Options":
          "nosniff"
      }
    }
  );
}


export default {
  async fetch(request) {
    if (
      request.method !== "GET"
    ) {
      return json(
        {
          ok: false,
          message:
            "Method not allowed."
        },
        405
      );
    }


    try {
      const admin =
        await verifyAdminRequest(
          request
        );


      return json({
        ok: true,

        authorized:
          true,

        admin
      });


    } catch (error) {
      if (
        error instanceof
        AdminAuthError
      ) {
        return json(
          {
            ok: false,

            authorized:
              false,

            message:
              error.message
          },
          error.status
        );
      }


      console.error(
        "Admin session error:",
        error
      );


      return json(
        {
          ok: false,

          authorized:
            false,

          message:
            "Could not verify admin session."
        },
        500
      );
    }
  }
};