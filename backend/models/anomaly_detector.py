import torch
import torch.nn as nn
import numpy as np
from typing import Optional
import logging
import os

logger = logging.getLogger(__name__)

class LSTMAutoencoder(nn.Module):
    def __init__(
        self,
        input_dim: int = 1287,
        hidden_dim: int = 256,
        latent_dim: int = 64,
        num_layers: int = 2,
        device: Optional[str] = None
    ):
        super(LSTMAutoencoder, self).__init__()
        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        self.latent_dim = latent_dim
        self.num_layers = num_layers
        if device is None:
            self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        else:
            self.device = torch.device(device)
        self.encoder_lstm = nn.LSTM(
            input_size=input_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=0.2 if num_layers > 1 else 0
        )
        self.encoder_to_latent = nn.Linear(hidden_dim, latent_dim)
        self.latent_to_decoder = nn.Linear(latent_dim, hidden_dim)
        self.decoder_lstm = nn.LSTM(
            input_size=hidden_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=0.2 if num_layers > 1 else 0
        )
        self.decoder_output = nn.Linear(hidden_dim, input_dim)
        self.to(self.device)
        self.baseline_mean = 0.0
        self.baseline_std = 1.0
        self.is_trained = False
        logger.info(f"Initialized LSTM Autoencoder on {self.device} (input={input_dim}, latent={latent_dim})")

    def encode(self, x):
        lstm_out, (hidden, cell) = self.encoder_lstm(x)
        last_hidden = hidden[-1]
        latent = self.encoder_to_latent(last_hidden)
        return latent

    def decode(self, latent, seq_len):
        batch_size = latent.size(0)
        decoder_hidden = self.latent_to_decoder(latent)
        decoder_input = decoder_hidden.unsqueeze(1).repeat(1, seq_len, 1)
        lstm_out, _ = self.decoder_lstm(decoder_input)
        reconstruction = self.decoder_output(lstm_out)
        return reconstruction

    def forward(self, x):
        seq_len = x.size(1)
        latent = self.encode(x)
        reconstruction = self.decode(latent, seq_len)
        return reconstruction

    def get_reconstruction_error(self, track, window_size: int = 10) -> float:
        combined_features = track.get_combined_features(window_size)
        if combined_features is None:
            logger.debug(f"Track {track.track_id} has insufficient frames for LSTM analysis")
            return 0.0
        if not self.is_trained:
            positions = np.array(track.positions[-window_size:])
            velocities = np.array([np.linalg.norm(v) for v in track.velocities[-window_size:]])
            velocity_std = np.std(velocities)
            score = min(1.0, velocity_std / 200.0)
            return score
        x = torch.FloatTensor(combined_features).unsqueeze(0).to(self.device)
        with torch.no_grad():
            reconstruction = self.forward(x)
        mse = torch.mean((x - reconstruction) ** 2).item()
        if self.baseline_std > 0:
            normalized_error = (mse - self.baseline_mean) / self.baseline_std
            score = 1.0 / (1.0 + np.exp(-normalized_error))
        else:
            score = min(1.0, mse / 10.0)
        return float(score)

    def update_baseline(self, reconstruction_errors: list):
        if len(reconstruction_errors) == 0:
            logger.warning("No reconstruction errors provided for baseline update")
            return
        self.baseline_mean = np.mean(reconstruction_errors)
        self.baseline_std = np.std(reconstruction_errors)
        logger.info(f"Updated baseline: mean={self.baseline_mean:.4f}, std={self.baseline_std:.4f}")

    def save_model(self, path: str):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        torch.save({
            'model_state_dict': self.state_dict(),
            'baseline_mean': self.baseline_mean,
            'baseline_std': self.baseline_std,
            'is_trained': self.is_trained,
            'input_dim': self.input_dim,
            'hidden_dim': self.hidden_dim,
            'latent_dim': self.latent_dim,
            'num_layers': self.num_layers
        }, path)
        logger.info(f"Model saved to {path}")

    def load_model(self, path: str):
        if not os.path.exists(path):
            logger.warning(f"Model file not found: {path}")
            return False
        checkpoint = torch.load(path, map_location=self.device)
        self.load_state_dict(checkpoint['model_state_dict'])
        self.baseline_mean = checkpoint.get('baseline_mean', 0.0)
        self.baseline_std = checkpoint.get('baseline_std', 1.0)
        self.is_trained = checkpoint.get('is_trained', False)
        logger.info(f"Model loaded from {path} (trained={self.is_trained})")
        return True

    def __repr__(self):
        return (f"LSTMAutoencoder(input_dim={self.input_dim}, latent_dim={self.latent_dim}, "
                f"device={self.device}, trained={self.is_trained})")
