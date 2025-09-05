exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200 };
  const auth = event.headers.authorization || "";
  if (auth !== `Bearer ${process.env.ADMIN_TOKEN}`)
    return { statusCode: 401, body: "Unauthorized" };

  if (event.httpMethod !== "POST") return { statusCode: 405, body: "POST only" };
  const { name, slug, summary, body, featureImageUrl, publishDate } = JSON.parse(event.body || "{}");
  if (!name) return { statusCode: 400, body: "Name required" };

  const payload = {
    isArchived: false,
    fieldData: {
      name,
      slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,""),
      Summary: summary || "",
      Body: body || "",
      "Feature Image": featureImageUrl ? { url: featureImageUrl } : null,
      "Publish Date": publishDate || new Date().toISOString()
    }
  };

  const res = await fetch(
    `https://api.webflow.com/v2/collections/${process.env.BLOG_POSTS_COLLECTION_ID}/items`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WEBFLOW_API_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    }
  );
  return { statusCode: res.status, body: await res.text() };
};
