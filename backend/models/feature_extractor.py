import torch
import torchvision.transforms as transforms
from torchvision.models import efficientnet_b0, EfficientNet_B0_Weights
import numpy as np
import cv2
from typing import Optional
import logging

logger = logging.getLogger(__name__)

class FeatureExtractor:
    def __init__(self, device: Optional[str] = None):
        if device is None:
            self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        else:
            self.device = torch.device(device)
        logger.info(f"Initializing EfficientNet on device: {self.device}")
        weights = EfficientNet_B0_Weights.IMAGENET1K_V1
        self.model = efficientnet_b0(weights=weights)
        self.model.classifier = torch.nn.Identity()
        self.model.eval()
        self.model.to(self.device)
        self.transform = transforms.Compose([
            transforms.ToPILImage(),
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            )
        ])
        logger.info("EfficientNet-B0 loaded successfully (1280-dim features)")

    def extract(self, frame: np.ndarray, bbox: np.ndarray) -> np.ndarray:
        x1, y1, x2, y2 = bbox.astype(int)
        h, w = frame.shape[:2]
        x1 = max(0, min(x1, w - 1))
        y1 = max(0, min(y1, h - 1))
        x2 = max(x1 + 1, min(x2, w))
        y2 = max(y1 + 1, min(y2, h))
        crop = frame[y1:y2, x1:x2]
        if crop.size == 0 or crop.shape[0] < 2 or crop.shape[1] < 2:
            logger.warning(f"Invalid crop size: {crop.shape}, returning zero features")
            return np.zeros(1280, dtype=np.float32)
        crop_rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
        input_tensor = self.transform(crop_rgb)
        input_batch = input_tensor.unsqueeze(0).to(self.device)
        with torch.no_grad():
            features = self.model(input_batch)
        features_np = features.cpu().numpy().flatten()
        return features_np

    def extract_batch(self, frame: np.ndarray, bboxes: list) -> list:
        if len(bboxes) == 0:
            return []
        crops = []
        valid_indices = []
        for idx, bbox in enumerate(bboxes):
            x1, y1, x2, y2 = bbox.astype(int)
            h, w = frame.shape[:2]
            x1 = max(0, min(x1, w - 1))
            y1 = max(0, min(y1, h - 1))
            x2 = max(x1 + 1, min(x2, w))
            y2 = max(y1 + 1, min(y2, h))
            crop = frame[y1:y2, x1:x2]
            if crop.size == 0 or crop.shape[0] < 2 or crop.shape[1] < 2:
                logger.warning(f"Skipping invalid crop at index {idx}")
                continue
            crop_rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
            crops.append(crop_rgb)
            valid_indices.append(idx)
        if len(crops) == 0:
            logger.warning("No valid crops for batch extraction")
            return [np.zeros(1280, dtype=np.float32) for _ in bboxes]
        input_tensors = torch.stack([self.transform(crop) for crop in crops])
        input_batch = input_tensors.to(self.device)
        with torch.no_grad():
            features_batch = self.model(input_batch)
        features_np = features_batch.cpu().numpy()
        results = [np.zeros(1280, dtype=np.float32) for _ in bboxes]
        for valid_idx, feat in zip(valid_indices, features_np):
            results[valid_idx] = feat
        return results

    def get_feature_dim(self) -> int:
        return 1280

    def __repr__(self):
        return f"FeatureExtractor(model=EfficientNet-B0, device={self.device}, feature_dim=1280)"
