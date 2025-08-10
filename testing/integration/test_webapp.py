"""
Integration tests for the web application.
"""

import json
import pytest
from webapp.app import create_app


@pytest.fixture
def client():
    """Create test client for the web application."""
    app = create_app()
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


class TestWebAppAPI:
    """Test cases for web application API endpoints."""

    def test_health_endpoint(self, client):
        """Test health check endpoint."""
        response = client.get('/health')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        
        assert data['status'] == 'healthy'
        assert 'pinecone_connected' in data
        assert 'stories_loaded' in data
        assert 'embedding_provider' in data
        assert 'embedding_dimension' in data

    def test_search_without_query(self, client):
        """Test search endpoint without query."""
        response = client.post('/search', 
                              data=json.dumps({}),
                              content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data

    def test_search_with_empty_query(self, client):
        """Test search endpoint with empty query."""
        response = client.post('/search',
                              data=json.dumps({'query': ''}),
                              content_type='application/json')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data

    def test_upload_without_file(self, client):
        """Test upload endpoint without file."""
        response = client.post('/upload')
        
        assert response.status_code == 400
        data = json.loads(response.data)
        assert 'error' in data

    def test_upload_with_csv(self, client, sample_csv_data):
        """Test uploading CSV data."""
        from io import BytesIO
        
        data = {
            'file': (BytesIO(sample_csv_data.encode()), 'test.csv')
        }
        
        response = client.post('/upload',
                              data=data,
                              content_type='multipart/form-data')
        
        assert response.status_code == 200
        response_data = json.loads(response.data)
        assert 'message' in response_data
        assert 'stories_loaded' in response_data

    def test_search_after_upload(self, client, sample_csv_data):
        """Test search functionality after uploading data."""
        from io import BytesIO
        
        # First upload data
        data = {
            'file': (BytesIO(sample_csv_data.encode()), 'test.csv')
        }
        
        upload_response = client.post('/upload',
                                    data=data,
                                    content_type='multipart/form-data')
        assert upload_response.status_code == 200
        
        # Then search
        search_response = client.post('/search',
                                    data=json.dumps({'query': 'Hero adventure'}),
                                    content_type='application/json')
        
        assert search_response.status_code == 200
        search_data = json.loads(search_response.data)
        
        assert 'query' in search_data
        assert 'results' in search_data
        assert 'total_found' in search_data

    def test_list_stories_empty(self, client):
        """Test listing stories when none are loaded."""
        response = client.get('/list-stories')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        
        assert 'stories' in data
        assert 'total_count' in data
        assert data['total_count'] == 0

    def test_feedback_without_feedback_db(self, client):
        """Test feedback endpoint when feedback DB is not configured."""
        response = client.get('/get-feedback')
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'feedback' in data
        assert data['feedback'] == []

    def test_home_page(self, client):
        """Test home page renders."""
        response = client.get('/')
        
        assert response.status_code == 200
        assert b'html' in response.data.lower()  # Basic check for HTML content
