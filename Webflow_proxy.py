import requests
from flask import Blueprint, request, jsonify

webflow_proxy_blueprint = Blueprint('webflow_proxy', __name__)

# --- FINAL CONFIGURATION ---
API_TOKEN = "aa08be8443f9e389f9c21e1fb6f4566517403ad131b31a7f3c1467ba49155c35"
SITE_ID = "688ed8debc05764047afa2a7"
COLLECTION_IDS = {
    "media_assets": "6891479d29ed1066b71124e9",
    "voxpro_assignments": "689ac6bdf10259dd9be04e16"
}
# --- END CONFIGURATION ---

API_BASE_URL = "https://api.webflow.com/v2"
HEADERS = {
    "accept": "application/json",
    "authorization": f"Bearer {API_TOKEN}"
}

@webflow_proxy_blueprint.route('/webflow_proxy', methods=['POST'] )
def proxy():
    # ... (The rest of the code for this file is exactly the same as my previous message) ...
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid JSON payload"}), 400

    endpoint_key = data.get('endpoint')
    method = data.get('method', 'GET').upper()
    body = data.get('body')
    url = ""

    if not endpoint_key:
        return jsonify({"error": "Endpoint key is missing"}), 400

    if '/' in endpoint_key:
        collection_key, item_id = endpoint_key.split('/', 1)
        collection_id = COLLECTION_IDS.get(collection_key)
        if not collection_id:
            return jsonify({"error": f"Invalid endpoint key: {collection_key}"}), 400
        url = f"{API_BASE_URL}/collections/{collection_id}/items/{item_id}"
    else:
        collection_id = COLLECTION_IDS.get(endpoint_key)
        if not collection_id:
            return jsonify({"error": f"Invalid endpoint key: {endpoint_key}"}), 400
        url = f"{API_BASE_URL}/collections/{collection_id}/items"

    try:
        req_headers = HEADERS.copy()
        if method in ['POST', 'PATCH']:
            req_headers['Content-Type'] = 'application/json'

        response = requests.request(method, url, headers=req_headers, json=body)
        response.raise_for_status()
        
        if response.status_code == 204 or not response.content:
            return jsonify({"success": True, "message": "Operation successful"}), 200
            
        return jsonify(response.json()), response.status_code

    except requests.exceptions.RequestException as e:
        error_message = f"API request failed: {e}"
        if e.response is not None:
            error_message += f" - Details: {e.response.text}"
        return jsonify({"error": error_message}), 500
