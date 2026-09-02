export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Vehicle to Mobile API Endpoint
    if (url.pathname === "/api/mobile") {
      const vehicle = url.searchParams.get("vehicle")?.toUpperCase().trim();
      
      if (!vehicle || vehicle.length < 6) {
        return Response.json({ 
          success: false, 
          error: "Valid vehicle number required (e.g. ?vehicle=KL41V3504)" 
        }, { status: 400, headers: corsHeaders });
      }

      try {
        const apiRes = await fetch("https://www.smcinsurance.com/central/centralcall/CallReqWithHeader", {
          method: "POST",
          headers: {
            "User-Agent": "okhttp/4.9.2",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            url: "GetVaahanDetailsByVehicleNo",
            props: [vehicle, "", "0"]
          })
        });

        const data = await apiRes.json();
        
        if (data.statusCode === 200 && data.response) {
          const info = data.response;
          return Response.json({
            success: true,
            vehicle_number: vehicle,
            mobile_number: info.mobile || "Not Available",
            owner_name: info.ownerName || "",
            chassis_number: info.chassis || "",
            engine_number: info.engine || "",
            maker_model: info.makerModel || ""
          }, { status: 200, headers: corsHeaders });
        } else {
          return Response.json({ 
            success: false, 
            error: "Mobile number or details not found for this vehicle." 
          }, { status: 404, headers: corsHeaders });
        }
      } catch (e) {
        return Response.json({ success: false, error: e.message }, { status: 500, headers: corsHeaders });
      }
    }

    return Response.json({ 
      name: "Vehicle to Mobile API",
      usage: "GET /api/mobile?vehicle=YOUR_VEHICLE_NUMBER" 
    }, { headers: corsHeaders });
  }
};
