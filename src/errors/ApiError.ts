import {status} from "grpc";

export default class ApiError extends Error {
    constructor(message: string, public code: status) {
        super(message);
    }
}