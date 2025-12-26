import numpy as np
from typing import List, Tuple, Dict, Optional
import logging

logger = logging.getLogger(__name__)

class ObjectTrack:
    def __init__(self, track_id: int, class_name: str, class_id: int):
        self.track_id = track_id
        self.class_name = class_name
        self.class_id = class_id
        self.frames: List[int] = []
        self.timestamps: List[float] = []
        self.bboxes: List[np.ndarray] = []
        self.confidences: List[float] = []
        self.features: List[np.ndarray] = []
        self.positions: List[Tuple[float, float]] = []
        self.velocities: List[Tuple[float, float]] = []
        self.accelerations: List[float] = []
        self.anomaly_scores: Dict[str, float] = {
            'teleporting': 0.0,
            'jittery': 0.0,
            'speed_change': 0.0,
            'disappearance': 0.0
        }
        self.is_active = True
        self.frames_since_update = 0
        self.hit_streak = 0

    def add_detection(
        self,
        frame_num: int,
        timestamp: float,
        bbox: np.ndarray,
        confidence: float,
        feature: Optional[np.ndarray] = None
    ):
        self.frames.append(frame_num)
        self.timestamps.append(timestamp)
        self.bboxes.append(bbox)
        self.confidences.append(confidence)
        if feature is not None:
            self.features.append(feature)
        cx = (bbox[0] + bbox[2]) / 2
        cy = (bbox[1] + bbox[3]) / 2
        self.positions.append((cx, cy))
        self._update_kinematics()
        self.frames_since_update = 0
        self.hit_streak += 1

    def _update_kinematics(self):
        if len(self.positions) < 2:
            self.velocities.append((0.0, 0.0))
            self.accelerations.append(0.0)
            return
        time_delta = self.timestamps[-1] - self.timestamps[-2]
        if time_delta > 0:
            dx = self.positions[-1][0] - self.positions[-2][0]
            dy = self.positions[-1][1] - self.positions[-2][1]
            vx = dx / time_delta
            vy = dy / time_delta
            self.velocities.append((vx, vy))
        else:
            self.velocities.append((0.0, 0.0))
        if len(self.velocities) >= 2:
            prev_vel = np.array(self.velocities[-2])
            curr_vel = np.array(self.velocities[-1])
            if time_delta > 0:
                accel = np.linalg.norm(curr_vel - prev_vel) / time_delta
                self.accelerations.append(accel)
            else:
                self.accelerations.append(0.0)
        else:
            self.accelerations.append(0.0)

    def get_last_bbox(self) -> Optional[np.ndarray]:
        return self.bboxes[-1] if self.bboxes else None

    def get_combined_features(self, window_size: int = 10) -> Optional[np.ndarray]:
        if len(self.features) < window_size:
            return None
        combined = []
        for i in range(-window_size, 0):
            cnn_feat = self.features[i]
            bbox = self.bboxes[i]
            width = bbox[2] - bbox[0]
            height = bbox[3] - bbox[1]
            cx, cy = self.positions[i]
            vx, vy = self.velocities[i] if i < len(self.velocities) else (0, 0)
            accel = self.accelerations[i] if i < len(self.accelerations) else 0
            geometric_feat = np.array([
                cx / 1920,
                cy / 1080,
                width / 1920,
                height / 1080,
                vx / 100,
                vy / 100,
                accel / 100
            ])
            combined_feat = np.concatenate([cnn_feat, geometric_feat])
            combined.append(combined_feat)
        return np.array(combined)

    def predict_next_position(self) -> Optional[Tuple[float, float]]:
        if len(self.positions) < 2 or len(self.velocities) < 1:
            return self.positions[-1] if self.positions else None
        last_pos = np.array(self.positions[-1])
        last_vel = np.array(self.velocities[-1])
        if len(self.timestamps) >= 2:
            time_delta = self.timestamps[-1] - self.timestamps[-2]
        else:
            time_delta = 0.5
        predicted_pos = last_pos + last_vel * time_delta
        return tuple(predicted_pos)

    def __repr__(self):
        return f"Track(id={self.track_id}, class={self.class_name}, frames={len(self.frames)}, active={self.is_active})"

class MultiObjectTracker:
    def __init__(self, max_age: int = 30, min_hits: int = 3, iou_threshold: float = 0.3):
        self.tracks: Dict[int, ObjectTrack] = {}
        self.next_id = 0
        self.max_age = max_age
        self.min_hits = min_hits
        self.iou_threshold = iou_threshold
        logger.info(f"Initialized MultiObjectTracker (max_age={max_age}, min_hits={min_hits}, iou_thresh={iou_threshold})")

    def update(
        self,
        detections: List[np.ndarray],
        class_names: List[str],
        features: List[np.ndarray],
        frame_num: int,
        timestamp: float
    ):
        for track in self.tracks.values():
            track.frames_since_update += 1
        if len(detections) == 0:
            self._remove_old_tracks()
            return
        matched_indices, unmatched_detections, unmatched_tracks = self._match_detections_to_tracks(
            detections
        )
        for det_idx, track_id in matched_indices:
            bbox = detections[det_idx][:4]
            conf = detections[det_idx][4]
            feat = features[det_idx] if det_idx < len(features) else None
            self.tracks[track_id].add_detection(
                frame_num, timestamp, bbox, conf, feat
            )
        for det_idx in unmatched_detections:
            bbox = detections[det_idx][:4]
            conf = detections[det_idx][4]
            class_id = int(detections[det_idx][5]) if len(detections[det_idx]) > 5 else 0
            class_name = class_names[det_idx] if det_idx < len(class_names) else "unknown"
            feat = features[det_idx] if det_idx < len(features) else None
            new_track = ObjectTrack(self.next_id, class_name, class_id)
            new_track.add_detection(frame_num, timestamp, bbox, conf, feat)
            self.tracks[self.next_id] = new_track
            self.next_id += 1
        self._remove_old_tracks()

    def _match_detections_to_tracks(
        self, detections: List[np.ndarray]
    ) -> Tuple[List[Tuple[int, int]], List[int], List[int]]:
        if len(self.tracks) == 0:
            return [], list(range(len(detections))), []
        iou_matrix = np.zeros((len(detections), len(self.tracks)))
        track_ids = list(self.tracks.keys())
        for d, det in enumerate(detections):
            det_bbox = det[:4]
            for t, track_id in enumerate(track_ids):
                track_bbox = self.tracks[track_id].get_last_bbox()
                if track_bbox is not None:
                    iou_matrix[d, t] = self._calculate_iou(det_bbox, track_bbox)
        matched_indices = []
        unmatched_detections = list(range(len(detections)))
        unmatched_tracks = list(range(len(track_ids)))
        while True:
            if iou_matrix.size == 0 or iou_matrix.max() < self.iou_threshold:
                break
            max_idx = np.unravel_index(iou_matrix.argmax(), iou_matrix.shape)
            det_idx, track_idx = max_idx
            matched_indices.append((det_idx, track_ids[track_idx]))
            iou_matrix[det_idx, :] = 0
            iou_matrix[:, track_idx] = 0
            if det_idx in unmatched_detections:
                unmatched_detections.remove(det_idx)
            if track_idx in unmatched_tracks:
                unmatched_tracks.remove(track_idx)
        unmatched_track_ids = [track_ids[i] for i in unmatched_tracks]
        return matched_indices, unmatched_detections, unmatched_track_ids

    def _calculate_iou(self, bbox1: np.ndarray, bbox2: np.ndarray) -> float:
        x1 = max(bbox1[0], bbox2[0])
        y1 = max(bbox1[1], bbox2[1])
        x2 = min(bbox1[2], bbox2[2])
        y2 = min(bbox1[3], bbox2[3])
        intersection = max(0, x2 - x1) * max(0, y2 - y1)
        area1 = (bbox1[2] - bbox1[0]) * (bbox1[3] - bbox1[1])
        area2 = (bbox2[2] - bbox2[0]) * (bbox2[3] - bbox2[1])
        union = area1 + area2 - intersection
        return intersection / union if union > 0 else 0

    def _remove_old_tracks(self):
        tracks_to_remove = []
        for track_id, track in self.tracks.items():
            if track.frames_since_update > self.max_age:
                tracks_to_remove.append(track_id)
                logger.debug(f"Removing old track {track_id} after {track.frames_since_update} frames")
        for track_id in tracks_to_remove:
            del self.tracks[track_id]

    def get_active_tracks(self, min_hits: Optional[int] = None) -> Dict[int, ObjectTrack]:
        if min_hits is None:
            min_hits = self.min_hits
        return {
            track_id: track
            for track_id, track in self.tracks.items()
            if track.hit_streak >= min_hits
        }

    def get_track_count(self) -> int:
        return len(self.tracks)

    def __repr__(self):
        return f"MultiObjectTracker(tracks={len(self.tracks)}, next_id={self.next_id})"
