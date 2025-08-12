from flask import Flask
from flask_cors import CORS
from routes.webflow_proxy import webflow_proxy_blueprint
import os

app = Flask(__name__)
CORS(app) # Allow all origins
app.register_blueprint(webflow_proxy_blueprint)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)
