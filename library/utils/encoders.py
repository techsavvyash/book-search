"""
JSON encoders for special data types.
"""

import json
import numpy as np


class NumpyEncoder(json.JSONEncoder):
    """
    JSON encoder that handles NumPy data types.
    
    Converts NumPy arrays and scalars to native Python types
    for JSON serialization.
    """
    
    def default(self, obj):
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        return super().default(obj)
