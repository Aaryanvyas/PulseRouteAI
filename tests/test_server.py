import json
import threading
import time
import urllib.request
import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
import server

class ServerTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        server.init_state()
        cls.httpd = server.HTTPServer(("127.0.0.1", 8085), server.PulseRouteHandler)
        cls.thread = threading.Thread(target=cls.httpd.serve_forever)
        cls.thread.daemon = True
        cls.thread.start()
        time.sleep(0.5)

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def test_get_reports(self):
        req = urllib.request.urlopen("http://127.0.0.1:8085/api/reports")
        self.assertEqual(req.status, 200)
        data = json.loads(req.read().decode("utf-8"))
        self.assertIn("reports", data)
        self.assertGreater(len(data["reports"]), 0)

    def test_post_triage(self):
        payload = json.dumps({
            "text": "Bridge washed away, 5 people trapped on high roof needing rescue boat",
            "latitude": 19.0900,
            "longitude": 72.8600
        }).encode("utf-8")
        req = urllib.request.Request("http://127.0.0.1:8085/api/triage", data=payload, headers={"Content-Type": "application/json"})
        resp = urllib.request.urlopen(req)
        self.assertEqual(resp.status, 201)
        data = json.loads(resp.read().decode("utf-8"))
        self.assertTrue(data.get("success"))
        self.assertEqual(data["report"]["predicted_urgency"], "critical")
        self.assertIn("rescue", data["report"]["resources"])

if __name__ == "__main__":
    unittest.main()
