import sys
import os

# Add the project root to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

from flask import Flask, render_template
from flask_cors import CORS
import serverless_wsgi

app = Flask(__name__, 
           template_folder=os.path.join(os.path.dirname(__file__), '..', '..', 'templates'),
           static_folder=os.path.join(os.path.dirname(__file__), '..', '..', 'static'))
CORS(app)

@app.route('/voxpro-manager')
def voxpro_manager():
    return render_template('voxpro-manager.html')

@app.route('/')
def home():
    return "VoxPro Backend API"

def handler(event, context):
    return serverless_wsgi.handle_request(app, event, context)
