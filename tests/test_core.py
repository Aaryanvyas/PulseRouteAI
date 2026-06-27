import unittest

from pulseroute.data import Report
from pulseroute.explain import explain_prediction
from pulseroute.geo import assign_location_clusters, haversine_km
from pulseroute.model import RulesUrgencyModel
from pulseroute.resources import extract_resources


class PulseRouteCoreTests(unittest.TestCase):
    def test_resource_extraction_detects_multiple_needs(self):
        resources = extract_resources("Pregnant woman needs ambulance and drinking water")
        self.assertIn("ambulance", resources)
        self.assertIn("water", resources)

    def test_rules_model_marks_life_threatening_report_critical(self):
        model = RulesUrgencyModel()
        prediction = model.predict_one("Accident victim bleeding and trapped under collapsed wall")
        self.assertEqual(prediction, "critical")

    def test_explanation_returns_relevant_keywords(self):
        explanation = explain_prediction("People trapped on roof with no food or water")
        self.assertIn("trapped", explanation)

    def test_haversine_distance_is_reasonable(self):
        distance = haversine_km(19.0760, 72.8777, 19.0761, 72.8778)
        self.assertLess(distance, 0.1)

    def test_cluster_assignment_groups_nearby_reports(self):
        reports = [
            Report("A", "Need help", 19.0760, 72.8777),
            Report("B", "Need food", 19.0761, 72.8778),
            Report("C", "Fire reported", 19.1762, 72.8758),
        ]
        clusters = assign_location_clusters(reports, radius_km=1.0)
        self.assertEqual(clusters["A"], clusters["B"])
        self.assertNotEqual(clusters["C"], clusters["A"])


if __name__ == "__main__":
    unittest.main()
