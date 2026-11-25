"""Guard the original authentication core from official commit 167de8a."""
import ast
import hashlib
import unittest
from pathlib import Path

BASELINE = {
    "create_oauth_state": "5b160c882303c47c70539d8751b0c363aa2569368ac862281a4e84b708bdf137",
    "verify_oauth_state": "68a64f2585591459f9ae5f48d4a2283d19f7dac04ff0ba0302d3f28aebfb1734",
    "get_valid_instagram_token": "9cbc25125fcceceb5fa489497e71a48761fb22242156fd6ccea4d52cfbe1e308",
    "_normalize_permalink": "480ac6811d41213e182100bc5e87ea267b96d0e642543c86f1dd061d202aec7f",
    "resolve_instagram_media_id": "fe68e45673a0634a1dad6bf99e00df70002b54cc98e66bff6406d1f09ae0ade2",
    "instagram_authorize": "aa29fa7b1d2770cc6960708bf9090b9713ba55d4227e8d8d2b9de7db92b07372",
    "instagram_callback": "d1586dc2b9e5371fc41a2546cd13f7e40abe470b1a9926bfe3c7ef1391c5df5c",
    "encrypt_token": "e4cf8aa7f0444a50ea48776efdadfa742613ad253be4342249d6f3943f72aa95",
    "decrypt_token": "2dac2257b64f907ef9eb170fb7b9a96051e659ad1cbe87675531a2820fb09961"
}
SOURCE_BASELINE = {
    "create_oauth_state": "707faa7c4816fd51088eb3498fbd79a741a4a8a1a1b17c7d5e362020bbf7dfb7",
    "verify_oauth_state": "efe7707f91d68ce84b24a6f3d14eec13836dbf8b55f4c1cece52a3f7cd6caa04",
    "get_valid_instagram_token": "a908ed0bcf08c58b62723b0b42c28309ab33859d37898e6dd7aa1ad64a0a7092",
    "_normalize_permalink": "c02eb7774f20665e01f020416c6290df8cd3475502b7585f633b76b309ebe429",
    "resolve_instagram_media_id": "79d46066f760bd85cb8a5971d6632601abd41074a614b215e16f7176e36d71aa",
    "instagram_authorize": "041c425ead38c89909c22caceb328be3b24d349694ac10c23a429ed885d6942a",
    "instagram_callback": "dbf0623b55419c8fc1eb51f9a6f2aa77704a1fe4fa91da62b68ec8454a47adb1",
    "encrypt_token": "e673b7f221726616434c8b3b4763b5328a79a6039c4cc7d8d3bbc37176dcedd9",
    "decrypt_token": "5bc3c5de16cd19747ec69389fd39a33ee3a72e349d49b380f72c47026af28eff"
}

class AuthenticationBaselineTests(unittest.TestCase):
    def test_original_authentication_functions_are_unchanged(self):
        source = Path(__file__).parents[1].joinpath('main.py').read_text(encoding='utf-8')
        functions = {node.name:node for node in ast.parse(source).body if isinstance(node,ast.FunctionDef)}
        for name, expected in BASELINE.items():
            with self.subTest(function=name):
                actual = hashlib.sha256(ast.dump(functions[name],include_attributes=False).encode()).hexdigest()
                self.assertEqual(actual, expected, f'{name} differs from the collaborator-owned original.')

    def test_original_authentication_source_text_is_unchanged(self):
        source = Path(__file__).parents[1].joinpath('main.py').read_text(encoding='utf-8')
        functions = {node.name:node for node in ast.parse(source).body if isinstance(node,ast.FunctionDef)}
        for name, expected in SOURCE_BASELINE.items():
            with self.subTest(function=name):
                actual = hashlib.sha256(ast.get_source_segment(source,functions[name]).encode()).hexdigest()
                self.assertEqual(actual, expected, f'{name} source text differs from the original.')
