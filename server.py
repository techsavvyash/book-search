"""
WSGI entrypoint for the book search web application.

This server uses the new modular structure with the book_search_core library
and the web_app Flask application.
"""

from webapp.app import create_app

app = create_app()

if __name__ == "__main__":
    import os

    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
