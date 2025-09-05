exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200 };
  const { postId } = event.queryStringParameters || {};
  if (!postId) return { statusCode: 400, body: "Missing postId" };

  const headers = { Authorization: `Bearer ${process.env.WEBFLOW_API_TOKEN}` };
  const url = `https://api.webflow.com/v2/collections/${process.env.COMMENTS_COLLECTION_ID}/items?limit=100`;
  const res = await fetch(url, { headers });
  const data = await res.json();
  const items = (data.items || []).filter(i =>
    i.fieldData.approved === true &&
    i.fieldData.post?.reference === postId
  ).sort((a, b) => new Date(a.createdOn) - new Date(b.createdOn));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(items.map(i => ({
      id: i.id,
      authorName: i.fieldData.authorName,
      message: i.fieldData.message,
      createdOn: i.createdOn
    })))
  };
};
