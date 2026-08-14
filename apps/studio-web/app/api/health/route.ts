export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    {
      status: "ok",
      service: "tehkne-studio-web",
      releaseChannel: "alpha",
      releaseGate: "alpha-01",
      productionReady: false,
      physicalPrototypeReady: false,
      signature: "Tehkné Solutions"
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    }
  );
}
