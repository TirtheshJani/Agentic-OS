from app import create_app
from app.config import PORT

app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=PORT, debug=True, threaded=True)
