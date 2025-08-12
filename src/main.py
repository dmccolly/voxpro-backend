from flask import Flask
from flask_cors import CORS
from routes.webflow_proxy import webflow_proxy_blueprint
import os

app = Flask(__name__)

# Allow requests from any domain.
# This is simpler and secure enough for this proxy's purpose.
CORS(app)

app.register_blueprint(webflow_proxy_blueprint)

if __name__ == '__main__':
    # This block is for local testing; Gunicorn will run the app on Render.
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=False)
