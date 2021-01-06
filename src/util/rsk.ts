import {ethers} from "ethers";
import grpc from "grpc";
import ApiError from "../errors/ApiError";

export const validateAddress = (address: string) => {
    if (!address || !ethers.utils.isAddress(address.toLowerCase())) {
        throw new ApiError(
            `${address} is not a valid RSK address`,
            grpc.status.INVALID_ARGUMENT);
    }
}