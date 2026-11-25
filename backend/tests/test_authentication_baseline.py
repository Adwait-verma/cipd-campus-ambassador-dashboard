"""Guard the original authentication core from commit 167de8a (official main)."""
import ast
import hashlib
import unittest
from pathlib import Path

BASELINE = {
    "create_oauth_state": "5b160c882303c47c70539d8751b0c363aa2569368ac862281a4e84b708bdf137",
    "verify_oauth_state": "68a64f2585591459f9ae5f48d4a2283d19f7dac04ff0ba0302d3f28aebfb1734",
    "get_valid_instagram_token": "9cbc25125fcceceb5fa489497e71a48761fb22242156fd6ccea4d52cfbe1e308",
    "_normalize_permalink": "480ac6811d41213e182100bc5e87ea267b96d0e642543c86f1dd061d202aec7f",
    "resolve_instagram_media_id": "62a868af7bdc8cd86535f94770b51b90c9783aa7a782cc3816a6cb6aef16e4e6",
    "instagram_authorize": "aa29fa7b1d2770cc6960708bf9090b9713ba55d4227e8d8d2b9de7db92b07372",
    "instagram_callback": "d1586dc2b9e5371fc41a2546cd13f7e40abe470b1a9926bfe3c7ef1391c5df5c",
    "encrypt_token": "e4cf8aa7f0444a50ea48776efdadfa742613ad253be4342249d6f3943f72aa95",
    "decrypt_token": "2dac2257b64f907ef9eb170fb7b9a96051e659ad1cbe87675531a2820fb09961"
}

class AuthenticationBaselineTests(unittest.TestCase):
    def test_original_authentication_functions_are_unchanged(self):
        source = Path(__file__).parents[1].joinpath('main.py').read_text(encoding='utf-8')
        functions = {node.name:node for node in ast.parse(source).body if isinstance(node,ast.FunctionDef)}
        for name, expected in BASELINE.items():
            with self.subTest(function=name):
                actual = hashlib.sha256(ast.dump(functions[name],include_attributes=False).encode()).hexdigest()
                self.assertEqual(actual, expected, f'{name} differs from the collaborator-owned original.')
