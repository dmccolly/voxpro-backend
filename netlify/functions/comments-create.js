exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200 };
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "POST only" };

  const { postId, authorName, authorEmail, message } = JSON.parse(event.body || "{}");
  if (!postId || !authorName || !message || message.length > 3000)
    return { statusCode: 400, body: "Invalid input" };

  const payload = {
    isArchived: false,
    fieldData: {
      post: { reference: postId },
      authorName,
      authorEmail: authorEmail || "",
      message,
      approved: false
    }
  };

  const res = await fetch(
    `https://api.webflow.com/v2/collections/${process.env.COMMENTS_COLLECTION_ID}/items`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WEBFLOW_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }
  );
  if (!res.ok) return { statusCode: res.status, body: await res.text() };
  return { statusCode: 200, body: "OK" };
};
