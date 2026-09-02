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

    if (url.pathname === "/api/mobile") {
      const vehicle = url.searchParams.get("vehicle")?.toUpperCase().trim();
      if (!vehicle || vehicle.length < 6) {
        return Response.json({ success: false, error: "Valid vehicle number required" }, { status: 400, headers: corsHeaders });
      }

      try {
        const startTime = Date.now();
        
        // 1. Fetch SMC details to get chassis, engine & direct mobile if available
        const smcRes = await fetch("https://www.smcinsurance.com/central/centralcall/CallReqWithHeader", {
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

        const smcData = await smcRes.json();
        if (!smcData || smcData.statusCode !== 200 || !smcData.response) {
          throw new Error("Vehicle details not found");
        }

        const info = smcData.response;
        const chassisFull = (info.chassis || "").replace(/\s+/g, "");
        const engineNo = info.engine || "";
        const chassisLast5 = chassisFull.slice(-5);
        let mobileNumber = info.mobile || "";

        // 2. Parivahan fallback lookup if mobile is hidden or missing
        if (!mobileNumber || mobileNumber.length !== 10) {
          try {
            let cookies = "";
            const headers = {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9"
            };

            const HP = "https://vahan.parivahan.gov.in/vahanservice/vahan/ui/statevalidation/homepage.xhtml?statecd=Mzc2MzM2MzAzNjY0MzIzODM3NjIzNjY0MzY2MjM3NDQ0Yw==";
            let res = await fetch(HP, { headers, redirect: "follow" });
            let setCookie = res.headers.get("set-cookie");
            if (setCookie) cookies = setCookie.split(',').map(c => c.split(';')[0]).join('; ');
            let html = await res.text();

            let vsMatch = html.match(/name="javax\.faces\.ViewState"[^>]*value="([^"]+)"/);
            let vs = vsMatch ? vsMatch[1] : null;

            if (vs) {
              const FR = "https://vahan.parivahan.gov.in/vahanservice/vahan/ui/balanceservice/form_reschedule_fitness.xhtml";
              let frRes = await fetch(FR, { headers: { ...headers, "Cookie": cookies } });
              let frHtml = await frRes.text();
              let frSetCookie = frRes.headers.get("set-cookie");
              if (frSetCookie) cookies += "; " + frSetCookie.split(',').map(c => c.split(';')[0]).join('; ');
              
              let frVsMatch = frHtml.match(/name="javax\.faces\.ViewState"[^>]*value="([^"]+)"/);
              let frVs = frVsMatch ? frVsMatch[1] : vs;

              const formData = new URLSearchParams();
              formData.append("javax.faces.partial.ajax", "true");
              formData.append("javax.faces.source", "balanceFeesFine:validate_dtls");
              formData.append("javax.faces.partial.execute", "@all");
              formData.append("javax.faces.partial.render", "balanceFeesFine:auth_panel");
              formData.append("balanceFeesFine:validate_dtls", "balanceFeesFine:validate_dtls");
              formData.append("balanceFeesFine", "balanceFeesFine");
              formData.append("balanceFeesFine:tf_reg_no", vehicle);
              formData.append("balanceFeesFine:tf_chasis_no", chassisLast5);
              formData.append("javax.faces.ViewState", frVs);

              let ajaxRes = await fetch(FR, {
                method: "POST",
                headers: {
                  ...headers,
                  "Cookie": cookies,
                  "Content-Type": "application/x-www-form-urlencoded",
                  "Faces-Request": "partial/ajax",
                  "X-Requested-With": "XMLHttpRequest",
                  "Referer": FR
                },
                body: formData.toString()
              });
              let ajaxHtml = await ajaxRes.text();
              
              let mobMatch = ajaxHtml.match(/value="(\d{10})"/);
              if (mobMatch && mobMatch[1].match(/^[6-9]/)) {
                mobileNumber = mobMatch[1];
              } else {
                let allNums = ajaxHtml.match(/\b[6-9]\d{9}\b/g);
                if (allNums && allNums.length > 0) mobileNumber = allNums[0];
              }
            }
          } catch (err) {}
        }

        const responseTime = parseFloat(((Date.now() - startTime) / 1000).toFixed(2));

        return Response.json({
          success: true,
          vehicle_number: vehicle,
          mobile_number: mobileNumber || "Not Available",
          owner_name: info.ownerName || "",
          chassis_number: chassisFull,
          engine_number: engineNo,
          maker_model: info.makerModel || "",
          response_time_seconds: responseTime
        }, { status: 200, headers: corsHeaders });

      } catch (e) {
        return Response.json({ success: false, error: e.message }, { status: 500, headers: corsHeaders });
      }
    }

    return Response.json({ name: "Vehicle Mobile API", usage: "GET /api/mobile?vehicle=KL41V3504" }, { headers: corsHeaders });
  }
};
