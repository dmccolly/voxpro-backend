exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200 };
  const auth = event.headers.authorization || "";
  if (auth !== `Bearer ${process.env.ADMIN_TOKEN}`)
    return { statusCode: 401, body: "Unauthorized" };

  const { id, action } = JSON.parse(event.body || "{}");
  if (!id || !["approve","delete"].includes(action))
    return { statusCode: 400, body: "Bad input" };

  const base = `https://api.webflow.com/v2/collections/${process.env.COMMENTS_COLLECTION_ID}/items/${id}`;

  if (action === "approve") {
    const res = await fetch(base, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${process.env.WEBFLOW_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ fieldData: { approved: true } })
    });
    return { statusCode: res.status, body: await res.text() };
  }
  if (action === "delete") {
    const res = await fetch(base, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${process.env.WEBFLOW_API_TOKEN}` }
    });
    return { statusCode: res.status, body: await res.text() };
  }
};
