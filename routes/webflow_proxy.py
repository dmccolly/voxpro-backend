import requests
from flask import Blueprint, request, jsonify
import os
import json

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

@webflow_proxy_blueprint.route('/webflow_proxy', methods=['POST', 'GET'] )
def proxy():
    # Health check endpoint for Render
    if request.method == 'GET':
        return jsonify({"status": "ok", "message": "Proxy is running"}), 200

    # Main proxy logic for POST requests
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Invalid JSON payload"}), 400

        endpoint_key = data.get('endpoint')
        method = data.get('method', 'GET').upper()
        body = data.get('body')
        url = ""

        print(f"Received request: Method={method}, Endpoint={endpoint_key}")

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

        req_headers = HEADERS.copy()
        if method in ['POST', 'PATCH']:
            req_headers['Content-Type'] = 'application/json'

        print(f"Proxying request to URL: {url}")
        response = requests.request(method, url, headers=req_headers, json=body, timeout=20)
        response.raise_for_status()

        # Handle successful but empty responses (e.g., DELETE or empty collections)
        if response.status_code == 204 or not response.content:
            print("Request successful with no content.")
            # For GET requests on an empty collection, Webflow returns a specific structure
            if method == 'GET' and not '/' in endpoint_key:
                 return jsonify({"items": [], "count": 0, "limit": 100, "offset": 0, "total": 0}), 200
            return jsonify({"success": True, "message": "Operation successful"}), 200

        print("Request successful with content.")
        return jsonify(response.json()), response.status_code

    except requests.exceptions.Timeout:
        print("Error: Request to Webflow API timed out.")
        return jsonify({"error": "The request to Webflow API timed out."}), 504
    except requests.exceptions.RequestException as e:
        error_message = f"API request failed: {e}"
        if e.response is not None:
            error_message += f" - Details: {e.response.text}"
        print(f"Error: {error_message}")
        return jsonify({"error": error_message}), 500
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return jsonify({"error": "An unexpected server error occurred."}), 500

