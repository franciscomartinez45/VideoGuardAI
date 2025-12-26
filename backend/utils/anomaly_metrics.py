import numpy as np
from scipy.ndimage import gaussian_filter1d
from typing import Dict
import logging

logger = logging.getLogger(__name__)

def detect_teleporting(track, distance_threshold: float = 200.0, velocity_threshold: float = 500.0) -> float:
    if len(track.positions) < 2:
        return 0.0
    max_score = 0.0
    for i in range(1, len(track.positions)):
        pos1 = np.array(track.positions[i - 1])
        pos2 = np.array(track.positions[i])
        distance = np.linalg.norm(pos2 - pos1)
        time_delta = track.timestamps[i] - track.timestamps[i - 1]
        velocity = distance / time_delta if time_delta > 0 else 0
        distance_score = min(1.0, distance / distance_threshold) if distance > distance_threshold else 0.0
        velocity_score = min(1.0, velocity / velocity_threshold) if velocity > velocity_threshold else 0.0
        score = max(distance_score, velocity_score)
        max_score = max(max_score, score)
    return max_score

def detect_jitter(
    track,
    window_size: int = 5,
    direction_change_threshold: int = 3,
    variance_threshold: float = 100.0
) -> float:
    if len(track.velocities) < window_size:
        return 0.0
    max_score = 0.0
    for i in range(len(track.velocities) - window_size + 1):
        window_velocities = track.velocities[i:i + window_size]
        direction_changes = 0
        for j in range(1, len(window_velocities)):
            v1 = np.array(window_velocities[j - 1])
            v2 = np.array(window_velocities[j])
            if np.dot(v1, v2) < 0:
                direction_changes += 1
        if i + window_size <= len(track.accelerations):
            window_accels = track.accelerations[i:i + window_size]
            accel_variance = np.var(window_accels) if len(window_accels) > 0 else 0
        else:
            accel_variance = 0
        direction_score = min(1.0, direction_changes / (direction_change_threshold * 2))
        variance_score = min(1.0, accel_variance / variance_threshold) if accel_variance > variance_threshold else 0.0
        score = 0.6 * direction_score + 0.4 * variance_score
        max_score = max(max_score, score)
    return max_score

def detect_speed_anomaly(
    track,
    smoothing_sigma: float = 2.0,
    threshold_ratio: float = 0.5
) -> float:
    if len(track.velocities) < 5:
        return 0.0
    speeds = np.array([np.linalg.norm(v) for v in track.velocities])
    smooth_speeds = gaussian_filter1d(speeds, sigma=smoothing_sigma)
    max_score = 0.0
    for i in range(len(speeds)):
        if smooth_speeds[i] > 1e-6:
            speed_diff = abs(speeds[i] - smooth_speeds[i])
            ratio = speed_diff / smooth_speeds[i]
            if ratio > threshold_ratio:
                score = min(1.0, ratio / (threshold_ratio * 2))
                max_score = max(max_score, score)
    return max_score

def detect_disappearance(
    track,
    max_gap_frames: int = 3,
    confidence_drop_threshold: float = 0.3
) -> float:
    if len(track.frames) < 2:
        return 0.0
    max_score = 0.0
    for i in range(1, len(track.frames)):
        frame_gap = track.frames[i] - track.frames[i - 1]
        confidence_drop = 0.0
        if i < len(track.confidences):
            confidence_drop = track.confidences[i - 1] - track.confidences[i]
        if frame_gap > 1:
            gap_score = min(1.0, (frame_gap - 1) / max_gap_frames)
        else:
            gap_score = 0.0
        conf_score = min(1.0, confidence_drop / confidence_drop_threshold) if confidence_drop > confidence_drop_threshold else 0.0
        score = max(gap_score, conf_score)
        max_score = max(max_score, score)
    return max_score

def detect_all_anomalies(track) -> Dict[str, float]:
    return {
        'teleporting': detect_teleporting(track),
        'jittery': detect_jitter(track),
        'speed_change': detect_speed_anomaly(track),
        'disappearance': detect_disappearance(track)
    }

def combine_scores(geometric_scores: Dict[str, float], lstm_score: float, lstm_weight: float = 0.3) -> Dict[str, float]:
    combined = {}
    geometric_weight = 1.0 - lstm_weight
    for anomaly_type, geometric_score in geometric_scores.items():
        combined[anomaly_type] = geometric_weight * geometric_score + lstm_weight * lstm_score
    return combined

def generate_user_friendly_summary(anomaly_results: list, total_tracks: int) -> Dict:
    examples_by_type = {
        'teleporting': [],
        'jittery': [],
        'speed_change': [],
        'disappearance': []
    }
    for result in anomaly_results:
        scores = result.get('scores', {})
        track_id = result.get('track_id')
        object_class = result.get('class', 'unknown')
        frames = result.get('frames', [])
        for anom_type, score in scores.items():
            if score > 0.5:
                examples_by_type[anom_type].append({
                    'track_id': track_id,
                    'object': object_class,
                    'score': round(float(score), 2),
                    'frames_count': len(frames)
                })
    breakdown = []
    disappearance_examples = examples_by_type['disappearance']
    if disappearance_examples:
        disappearance_examples.sort(key=lambda x: x['frames_count'])
        examples = [
            f"{ex['object'].capitalize()} (track {ex['track_id']}) only visible in {ex['frames_count']} frames"
            for ex in disappearance_examples
        ]
        breakdown.append({
            'type': 'Disappearance Events',
            'count': len(disappearance_examples),
            'severity': 'medium',
            'description': 'Objects appearing and disappearing with tracking gaps',
            'examples': examples
        })
    else:
        breakdown.append({
            'type': 'Disappearance Events',
            'count': 0,
            'severity': 'none',
            'description': 'No disappearance events detected',
            'examples': []
        })
    speed_examples = examples_by_type['speed_change']
    if speed_examples:
        speed_examples.sort(key=lambda x: x['score'], reverse=True)
        examples = [
            f"{ex['object'].capitalize()} (track {ex['track_id']}) score: {ex['score']}"
            for ex in speed_examples
        ]
        breakdown.append({
            'type': 'Speed Anomalies',
            'count': len(speed_examples),
            'severity': 'medium',
            'description': 'Unnatural acceleration or deceleration detected',
            'examples': examples
        })
    else:
        breakdown.append({
            'type': 'Speed Anomalies',
            'count': 0,
            'severity': 'none',
            'description': 'No speed anomalies detected',
            'examples': []
        })
    jittery_examples = examples_by_type['jittery']
    if jittery_examples:
        jittery_examples.sort(key=lambda x: x['score'], reverse=True)
        examples = [
            f"{ex['object'].capitalize()} (track {ex['track_id']}) erratic movement score: {ex['score']}"
            for ex in jittery_examples
        ]
        breakdown.append({
            'type': 'Jittery Motion',
            'count': len(jittery_examples),
            'severity': 'low',
            'description': 'Erratic or shaky object movement',
            'examples': examples
        })
    else:
        breakdown.append({
            'type': 'Jittery Motion',
            'count': 0,
            'severity': 'none',
            'description': 'No jittery motion detected',
            'examples': []
        })
    teleport_examples = examples_by_type['teleporting']
    if teleport_examples:
        teleport_examples.sort(key=lambda x: x['score'], reverse=True)
        examples = [
            f"{ex['object'].capitalize()} (track {ex['track_id']}) sudden jump score: {ex['score']}"
            for ex in teleport_examples
        ]
        breakdown.append({
            'type': 'Teleporting',
            'count': len(teleport_examples),
            'severity': 'high',
            'description': 'Sudden position jumps detected',
            'examples': examples
        })
    else:
        breakdown.append({
            'type': 'Teleporting',
            'count': 0,
            'severity': 'none',
            'description': 'No sudden position jumps detected',
            'examples': []
        })
    most_problematic = []
    for result in anomaly_results:
        scores = result.get('scores', {})
        issues = [k for k, v in scores.items() if v > 0.5]
        max_score = max(scores.values()) if scores else 0
        if issues:
            most_problematic.append({
                'track_id': int(result.get('track_id')),
                'object': str(result.get('class', 'unknown')),
                'issues': issues,
                'max_score': round(float(max_score), 2)
            })
    most_problematic.sort(key=lambda x: x['max_score'], reverse=True)
    return {
        'overview': {
            'total_anomalies_detected': len(anomaly_results),
            'total_objects_tracked': total_tracks,
            'objects_with_issues': len(anomaly_results),
            'clean_objects': max(0, total_tracks - len(anomaly_results))
        },
        'anomaly_breakdown': breakdown,
        'most_problematic_objects': most_problematic[:5]
    }
